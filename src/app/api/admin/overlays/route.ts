import { asc } from "drizzle-orm";
import { overlayStates } from "@/db/schema";
import { adminRoute } from "@/lib/api/handler";
import { OVERLAY_KEYS } from "@/lib/labels";
import { resolveOverlay } from "@/server/live";

/** 오버레이 설정 + 실제 송출 상태(해석 결과) */
export const GET = adminRoute("overlays.manage", async ({ db }) => {
  const rows = await db.select().from(overlayStates).orderBy(asc(overlayStates.key));
  const resolved = await Promise.all(OVERLAY_KEYS.map(async (k) => ({ key: k, ...(await resolveOverlay(db, k)) })));
  return { serverTime: new Date().toISOString(), configs: rows, resolved };
});
