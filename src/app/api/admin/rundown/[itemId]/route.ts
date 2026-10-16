import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { episodes, rundownItems } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { zOptText, zOptUuid, zText, zUuid, zVersion } from "@/lib/validation";
import { assertAnchors, bumpEpisode, lockEpisode } from "@/server/episodes";

const PatchInput = z.object({
  version: zVersion,
  title: zText(150).optional(),
  anchorId: zOptUuid.optional(),
  plannedSeconds: z.number().int().min(0).max(7200).optional(),
  notes: zOptText(1000, true).optional(),
  status: z.enum(["PENDING", "ON_AIR", "DONE", "SKIPPED"]).optional(),
  articleId: zOptUuid.optional(),
  clipId: zOptUuid.optional(),
});

/** 큐시트 항목 수정 (진행자 전환·예상 시간·상태). 진행자는 자신의 대본·진행 관련 필드만 수정할 수 있다. */
export const PATCH = adminRoute<{ itemId: string }>("rundown.operate", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.itemId);
  const { version, ...fields } = await readJson(req, PatchInput);
  const isManager = session.roles.some((r) => r === "SUPER_ADMIN" || r === "EDITOR" || r === "OPERATOR");
  if (!isManager && (fields.title !== undefined || fields.articleId !== undefined || fields.clipId !== undefined)) {
    throw new ApiError(403, "큐시트 구성 변경 권한이 없습니다.");
  }
  if (fields.anchorId) await db.transaction((tx) => assertAnchors(tx, [fields.anchorId!]));
  const values = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  const row = await versionedUpdate(db, rundownItems, id, version, values);
  // 진행 화면(프롬프터·지통실)이 변경을 감지하도록 회차 수정 시각을 갱신한다
  await db.update(episodes).set({ updatedAt: new Date() }).where(eq(episodes.id, row.episodeId));
  await audit("RUNDOWN_UPDATE", "rundown_item", id, values);
  return { item: row };
});

/** 큐시트 항목 삭제 (?episodeVersion= 필요) */
export const DELETE = adminRoute<{ itemId: string }>("episodes.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.itemId);
  const episodeVersion = Number(req.nextUrl.searchParams.get("episodeVersion"));
  if (!Number.isInteger(episodeVersion)) throw new ApiError(400, "episodeVersion 이 필요합니다.");
  const [item] = await db.select().from(rundownItems).where(eq(rundownItems.id, id));
  if (!item) throw notFound("큐시트 항목");
  return db.transaction(async (tx) => {
    const ep = await lockEpisode(tx, item.episodeId, episodeVersion);
    if (ep.currentItemId === id) throw new ApiError(409, "현재 진행 중인 항목은 삭제할 수 없습니다.");
    await tx.delete(rundownItems).where(and(eq(rundownItems.id, id), eq(rundownItems.episodeId, item.episodeId)));
    const updated = await bumpEpisode(tx, item.episodeId);
    await audit("RUNDOWN_DELETE", "rundown_item", id, { title: item.title }, tx);
    return { episodeVersion: updated.version };
  });
});
