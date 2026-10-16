import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { incidents, mediaFiles, reportMedia, reports } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { zOptDate, zOptText, zOptUuid, zUuid, zVersion } from "@/lib/validation";

const PatchInput = z.object({
  version: zVersion,
  action: z.enum(["review", "approve", "reject", "reopen", "update"]),
  rejectReason: zOptText(500, true).optional(),
  incidentId: zOptUuid.optional(),
  isSensitive: z.boolean().optional(),
  publicSummary: zOptText(1000, true).optional(),
  publicAfter: zOptDate.optional(),
  adminNote: zOptText(1000, true).optional(),
});

/**
 * 제보 처리: 접수 → 확인 중 → 승인/반려 (→ 기사 발행 시 자동으로 '기사화')
 * 승인 전 제보와 증거 이미지는 공개되지 않는다.
 */
export const PATCH = adminRoute<{ id: string }>("reports.review", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, PatchInput);
  const [current] = await db.select().from(reports).where(eq(reports.id, id));
  if (!current) throw notFound("제보");

  const values: Record<string, unknown> = {};
  if (input.incidentId !== undefined) {
    if (input.incidentId) {
      const [inc] = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.id, input.incidentId));
      if (!inc) throw new ApiError(400, "사건을 찾을 수 없습니다.");
    }
    values.incidentId = input.incidentId;
  }
  if (input.isSensitive !== undefined) values.isSensitive = input.isSensitive;
  if (input.publicSummary !== undefined) values.publicSummary = input.publicSummary;
  if (input.publicAfter !== undefined) values.publicAfter = input.publicAfter;
  if (input.adminNote !== undefined) values.adminNote = input.adminNote;

  switch (input.action) {
    case "review":
      values.status = "REVIEWING";
      break;
    case "approve": {
      const sensitive = (values.isSensitive as boolean | undefined) ?? current.isSensitive;
      const summary = (values.publicSummary as string | null | undefined) ?? current.publicSummary;
      if (sensitive && !summary) throw new ApiError(400, "민감 제보는 공개 요약을 입력해야 승인할 수 있습니다.");
      values.status = "APPROVED";
      values.rejectReason = null;
      values.reviewerId = session.userId;
      values.reviewedAt = new Date();
      break;
    }
    case "reject":
      if (!input.rejectReason) throw new ApiError(400, "반려 사유를 입력하세요.");
      values.status = "REJECTED";
      values.rejectReason = input.rejectReason;
      values.reviewerId = session.userId;
      values.reviewedAt = new Date();
      break;
    case "reopen":
      values.status = "REVIEWING";
      break;
    case "update":
      break;
  }

  const updated = await db.transaction(async (tx) => {
    const row = await versionedUpdate(tx, reports, id, input.version, values);
    // 증거 이미지 공개 여부: 승인(또는 기사화) + 비민감일 때만 공개
    const visible = (row.status === "APPROVED" || row.status === "PUBLISHED") && !row.isSensitive;
    const mediaIds = (await tx.select({ id: reportMedia.mediaId }).from(reportMedia).where(eq(reportMedia.reportId, id))).map((m) => m.id);
    if (mediaIds.length) await tx.update(mediaFiles).set({ isPublic: visible }).where(inArray(mediaFiles.id, mediaIds));
    await audit(`REPORT_${input.action.toUpperCase()}`, "report", id, { status: row.status, incidentId: row.incidentId, rejectReason: row.rejectReason }, tx);
    return row;
  });
  const { submitterIpHash: _ip, ...rest } = updated;
  void _ip;
  return { report: rest };
});
