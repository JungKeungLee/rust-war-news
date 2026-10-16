import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { reports } from "@/db/schema";

/** 사건 기사 발행 시, 해당 사건에 연결된 승인 제보를 '기사화' 상태로 전환 */
export async function markReportsPublished(tx: Tx, incidentId: string | null) {
  if (!incidentId) return;
  await tx
    .update(reports)
    .set({ status: "PUBLISHED", updatedAt: new Date() })
    .where(and(eq(reports.incidentId, incidentId), eq(reports.status, "APPROVED")));
}
