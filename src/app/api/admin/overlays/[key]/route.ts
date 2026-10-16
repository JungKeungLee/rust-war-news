import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { overlayStates } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ConflictError, notFound } from "@/lib/api/errors";
import { OVERLAY_KEYS, type OverlayKey } from "@/lib/labels";
import { cleanText } from "@/lib/security/sanitize";

const str = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => cleanText(s).slice(0, max));

/** 오버레이별 수동 입력 값 (모두 문자열, HTML 제거) */
const Payload = z
  .object({
    breakingId: z.uuid().optional(),
    items: z.array(str(120)).max(20).optional(),
    label: str(30).optional(),
    title: str(120).optional(),
    subtitle: str(200).optional(),
    name: str(40).optional(),
    role: str(60).optional(),
    message: str(200).optional(),
    startsAt: str(40).optional(),
  })
  .strict();

const Input = z.object({ version: z.number().int().min(1), mode: z.enum(["AUTO", "MANUAL", "OFF"]), payload: Payload.default({}) });

export const PATCH = adminRoute<{ key: string }>("overlays.manage", async ({ req, db, params, session, audit }) => {
  if (!OVERLAY_KEYS.includes(params.key as OverlayKey)) throw notFound("오버레이");
  const input = await readJson(req, Input);
  const [row] = await db
    .update(overlayStates)
    .set({ mode: input.mode, payload: input.payload, version: sql`${overlayStates.version} + 1`, updatedBy: session.userId, updatedAt: new Date() })
    .where(sql`${overlayStates.key} = ${params.key} and ${overlayStates.version} = ${input.version}`)
    .returning();
  if (!row) {
    const [cur] = await db.select().from(overlayStates).where(eq(overlayStates.key, params.key));
    if (!cur) throw notFound("오버레이");
    throw new ConflictError(cur);
  }
  await audit("OVERLAY_UPDATE", "overlay", params.key, { mode: row.mode, payload: row.payload });
  return { overlay: row };
});
