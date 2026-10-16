import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { rundownItems } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError, ConflictError } from "@/lib/api/errors";
import { zOptUuid, zUuid } from "@/lib/validation";
import { bumpEpisode, lockEpisode } from "@/server/episodes";

const CueInput = z.object({
  action: z.enum(["next", "prev", "goto", "skip"]),
  itemId: zOptUuid.optional(),
  /** 요청자가 보고 있던 현재 항목. 다른 운영자가 먼저 넘겼다면 409 */
  expectedCurrentId: zOptUuid,
});

/** 방송 진행: 다음/이전/지정 항목으로 큐 이동. 현재 항목은 완료 처리된다. */
export const POST = adminRoute<{ id: string }>("rundown.operate", async ({ req, db, params, audit }) => {
  const episodeId = zUuid.parse(params.id);
  const input = await readJson(req, CueInput);
  return db.transaction(async (tx) => {
    const ep = await lockEpisode(tx, episodeId);
    if (ep.status !== "LIVE") throw new ApiError(409, "방송 중인 회차에서만 진행할 수 있습니다.");
    if ((ep.currentItemId ?? null) !== (input.expectedCurrentId ?? null)) throw new ConflictError({ currentItemId: ep.currentItemId });

    const items = await tx.select().from(rundownItems).where(eq(rundownItems.episodeId, episodeId)).orderBy(asc(rundownItems.position));
    const idx = items.findIndex((i) => i.id === ep.currentItemId);
    let target: (typeof items)[number] | undefined;
    if (input.action === "goto") target = items.find((i) => i.id === input.itemId);
    else if (input.action === "prev") target = idx > 0 ? items[idx - 1] : undefined;
    else target = items.slice(idx + 1).find((i) => i.status !== "SKIPPED" && i.status !== "DONE") ?? items[idx + 1];
    if (input.action === "goto" && !target) throw new ApiError(400, "큐시트 항목을 찾을 수 없습니다.");

    const now = new Date();
    if (ep.currentItemId) {
      await tx
        .update(rundownItems)
        .set({ status: input.action === "skip" ? "SKIPPED" : "DONE", finishedAt: now, updatedAt: now })
        .where(and(eq(rundownItems.id, ep.currentItemId), eq(rundownItems.episodeId, episodeId)));
    }
    if (target) {
      await tx.update(rundownItems).set({ status: "ON_AIR", startedAt: now, finishedAt: null, updatedAt: now }).where(eq(rundownItems.id, target.id));
    }
    const updated = await bumpEpisode(tx, episodeId, { currentItemId: target?.id ?? null });
    await audit(`CUE_${input.action.toUpperCase()}`, "episode", episodeId, { from: ep.currentItemId, to: target?.id ?? null }, tx);
    return { currentItemId: target?.id ?? null, episodeVersion: updated.version };
  });
});
