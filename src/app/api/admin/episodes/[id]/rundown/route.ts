import { asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { rundownItems } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { RundownItemFields } from "@/lib/schemas";
import { zUuid, zVersion } from "@/lib/validation";
import { assertAnchors, bumpEpisode, lockEpisode } from "@/server/episodes";

const AddInput = RundownItemFields.extend({ episodeVersion: zVersion });

/** 큐시트 항목 추가 (기사·클립·속보·코너) */
export const POST = adminRoute<{ id: string }>("episodes.manage", async ({ req, db, params, audit }) => {
  const episodeId = zUuid.parse(params.id);
  const { episodeVersion, ...input } = await readJson(req, AddInput);
  if (input.kind === "ARTICLE" && !input.articleId) throw new ApiError(400, "연결할 기사를 선택하세요.");
  if (input.kind === "CLIP" && !input.clipId) throw new ApiError(400, "연결할 클립을 선택하세요.");
  return db.transaction(async (tx) => {
    const ep = await lockEpisode(tx, episodeId, episodeVersion);
    if (ep.status === "ENDED") throw new ApiError(409, "종료된 회차의 큐시트는 변경할 수 없습니다.");
    if (input.anchorId) await assertAnchors(tx, [input.anchorId]);
    const [{ m }] = await tx.select({ m: max(rundownItems.position) }).from(rundownItems).where(eq(rundownItems.episodeId, episodeId));
    const [item] = await tx
      .insert(rundownItems)
      .values({ ...input, episodeId, position: (m ?? -1) + 1 })
      .returning();
    const updated = await bumpEpisode(tx, episodeId);
    await audit("RUNDOWN_ADD", "rundown_item", item.id, { episodeId, title: item.title }, tx);
    return { item, episodeVersion: updated.version };
  });
});

const ReorderInput = z.object({ episodeVersion: zVersion, order: z.array(z.uuid()).max(200) });

/**
 * 큐시트 순서 변경. 회차 행 잠금 + 버전 검사로, 두 관리자가 동시에 순서를 바꾸면
 * 나중 요청은 409 충돌로 거부되고 최신 큐시트를 다시 받아야 한다.
 */
export const PUT = adminRoute<{ id: string }>("episodes.manage", async ({ req, db, params, audit }) => {
  const episodeId = zUuid.parse(params.id);
  const { episodeVersion, order } = await readJson(req, ReorderInput);
  return db.transaction(async (tx) => {
    await lockEpisode(tx, episodeId, episodeVersion);
    const items = await tx.select({ id: rundownItems.id }).from(rundownItems).where(eq(rundownItems.episodeId, episodeId)).orderBy(asc(rundownItems.position));
    const existing = new Set(items.map((i) => i.id));
    if (order.length !== existing.size || order.some((id) => !existing.has(id)) || new Set(order).size !== order.length) {
      throw new ApiError(409, "큐시트 항목 구성이 변경되었습니다. 새로고침 후 다시 시도하세요.");
    }
    for (const [position, id] of order.entries()) {
      await tx.update(rundownItems).set({ position, updatedAt: new Date() }).where(eq(rundownItems.id, id));
    }
    const updated = await bumpEpisode(tx, episodeId);
    await audit("RUNDOWN_REORDER", "episode", episodeId, { order }, tx);
    return { episodeVersion: updated.version };
  });
});
