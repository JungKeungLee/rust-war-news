import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { rundownItems, rundownScripts } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError, ConflictError, notFound } from "@/lib/api/errors";
import { zLongText, zUuid } from "@/lib/validation";
import { assertAnchors } from "@/server/episodes";

const Input = z.object({
  anchorId: z.uuid(),
  body: zLongText(20000, 0),
  /** 새 대본이면 null, 기존 대본 수정이면 현재 버전 */
  version: z.number().int().min(1).nullable(),
});

/**
 * 진행자별 대본 저장. (항목, 진행자) 당 하나의 대본.
 * ANCHOR 는 자기 대본만 수정할 수 있고, 편집자·운영자는 모든 진행자 대본을 수정할 수 있다.
 */
export const PUT = adminRoute<{ itemId: string }>("rundown.script", async ({ req, db, params, session, audit }) => {
  const itemId = zUuid.parse(params.itemId);
  const input = await readJson(req, Input);
  const isManager = session.roles.some((r) => r === "SUPER_ADMIN" || r === "EDITOR" || r === "OPERATOR");
  if (!isManager && input.anchorId !== session.userId) throw new ApiError(403, "다른 진행자의 대본은 수정할 수 없습니다.");
  const [item] = await db.select({ id: rundownItems.id }).from(rundownItems).where(eq(rundownItems.id, itemId));
  if (!item) throw notFound("큐시트 항목");

  return db.transaction(async (tx) => {
    await assertAnchors(tx, [input.anchorId]);
    let row;
    if (input.version === null) {
      [row] = await tx
        .insert(rundownScripts)
        .values({ rundownItemId: itemId, anchorId: input.anchorId, body: input.body, updatedBy: session.userId })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        const [cur] = await tx.select().from(rundownScripts).where(and(eq(rundownScripts.rundownItemId, itemId), eq(rundownScripts.anchorId, input.anchorId)));
        throw new ConflictError(cur);
      }
    } else {
      [row] = await tx
        .update(rundownScripts)
        .set({ body: input.body, version: sql`${rundownScripts.version} + 1`, updatedBy: session.userId, updatedAt: new Date() })
        .where(and(eq(rundownScripts.rundownItemId, itemId), eq(rundownScripts.anchorId, input.anchorId), eq(rundownScripts.version, input.version)))
        .returning();
      if (!row) {
        const [cur] = await tx.select().from(rundownScripts).where(and(eq(rundownScripts.rundownItemId, itemId), eq(rundownScripts.anchorId, input.anchorId)));
        throw new ConflictError(cur);
      }
    }
    await audit("SCRIPT_SAVE", "rundown_script", row.id, { itemId, anchorId: input.anchorId, version: row.version }, tx);
    return { script: row };
  });
});
