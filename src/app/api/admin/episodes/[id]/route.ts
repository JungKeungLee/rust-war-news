import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { episodes, rundownItems } from "@/db/schema";
import { getSettings, saveBroadcast } from "@/server/settings";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { EpisodeFields } from "@/lib/schemas";
import { zUuid, zVersion } from "@/lib/validation";
import { getEpisodeFull } from "@/server/admin";
import { assertAnchors, bumpEpisode, lockEpisode, setEpisodeAnchors } from "@/server/episodes";

export const GET = adminRoute<{ id: string }>("rundown.operate", async ({ db, params }) => {
  const data = await getEpisodeFull(db, zUuid.parse(params.id));
  if (!data) throw notFound("방송 회차");
  return { ...data, serverTime: new Date().toISOString() };
});

const PatchInput = z.discriminatedUnion("action", [
  EpisodeFields.extend({ action: z.literal("update"), version: zVersion }),
  z.object({ action: z.literal("ready"), version: zVersion }),
  z.object({ action: z.literal("start"), version: zVersion, syncLive: z.boolean().default(true) }),
  z.object({ action: z.literal("end"), version: zVersion, syncLive: z.boolean().default(true), publishArchive: z.boolean().default(false) }),
  z.object({ action: z.literal("archive"), version: zVersion, isPublic: z.boolean() }),
]);

/** 방송 회차 상태: 기획 → 준비 완료 → 방송 중 → 방송 종료(→ 아카이브 공개) */
export const PATCH = adminRoute<{ id: string }>("episodes.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, PatchInput);

  return db.transaction(async (tx) => {
    const ep = await lockEpisode(tx, id, input.version);
    const now = new Date();
    let row;
    switch (input.action) {
      case "update": {
        const { action: _a, version: _v, anchorIds, ...fields } = input;
        void _a;
        void _v;
        await assertAnchors(tx, anchorIds);
        await setEpisodeAnchors(tx, id, anchorIds);
        row = await bumpEpisode(tx, id, fields);
        break;
      }
      case "ready":
        if (ep.status !== "PLANNED") throw new ApiError(409, "기획 단계의 회차만 준비 완료로 바꿀 수 있습니다.");
        row = await bumpEpisode(tx, id, { status: "READY" });
        break;
      case "start": {
        if (ep.status === "LIVE" || ep.status === "ENDED") throw new ApiError(409, "이미 시작했거나 종료된 회차입니다.");
        const [other] = await tx.select({ id: episodes.id, title: episodes.title }).from(episodes).where(and(eq(episodes.status, "LIVE"), ne(episodes.id, id)));
        if (other) throw new ApiError(409, `다른 회차(${other.title})가 방송 중입니다. 먼저 종료하세요.`);
        row = await bumpEpisode(tx, id, { status: "LIVE", startedAt: now });
        if (input.syncLive) {
          // 메인 방송 상태를 LIVE 로 (방송 URL 이 비어 있으면 회차의 생방송 주소 사용)
          const { broadcast } = await getSettings(tx);
          await saveBroadcast(tx, { ...broadcast, status: "LIVE", url: broadcast.url ?? ep.liveUrl, title: broadcast.title ?? ep.title }, session.userId);
        }
        break;
      }
      case "end": {
        if (ep.status !== "LIVE") throw new ApiError(409, "방송 중인 회차만 종료할 수 있습니다.");
        await tx.update(rundownItems).set({ status: "DONE", finishedAt: now, updatedAt: now }).where(and(eq(rundownItems.episodeId, id), eq(rundownItems.status, "ON_AIR")));
        row = await bumpEpisode(tx, id, { status: "ENDED", endedAt: now, currentItemId: null, isPublic: input.publishArchive || ep.isPublic });
        if (input.syncLive) {
          const { broadcast } = await getSettings(tx);
          await saveBroadcast(tx, { ...broadcast, status: "OFFLINE" }, session.userId);
        }
        break;
      }
      case "archive":
        if (ep.status !== "ENDED") throw new ApiError(409, "종료된 회차만 아카이브에 공개할 수 있습니다.");
        row = await bumpEpisode(tx, id, { isPublic: input.isPublic });
        break;
    }
    await audit(`EPISODE_${input.action.toUpperCase()}`, "episode", id, { status: row.status, isPublic: row.isPublic }, tx);
    return { episode: row };
  });
});
