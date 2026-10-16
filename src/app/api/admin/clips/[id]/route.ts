import { eq } from "drizzle-orm";
import { z } from "zod";
import { clips } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { isAllowedEmbedUrl } from "@/lib/clips/embed";
import { zOptText, zOptUrl, zOptUuid, zText, zUuid, zVersion } from "@/lib/validation";

const PatchInput = z.object({
  version: zVersion,
  action: z.enum(["approve", "reject", "update"]),
  rejectReason: zOptText(300, true).optional(),
  title: zText(100).optional(),
  description: zOptText(1000, true).optional(),
  isHot: z.boolean().optional(),
  embedUrl: zOptUrl.optional(),
  thumbnailUrl: zOptUrl.optional(),
  teamId: zOptUuid.optional(),
  playerId: zOptUuid.optional(),
  incidentId: zOptUuid.optional(),
});

/** 클립 승인·반려·핫 클립 선정·임베드 설정 */
export const PATCH = adminRoute<{ id: string }>("clips.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const { version, action, rejectReason, ...fields } = await readJson(req, PatchInput);
  const [current] = await db.select({ id: clips.id }).from(clips).where(eq(clips.id, id));
  if (!current) throw notFound("클립");
  if (fields.embedUrl && !isAllowedEmbedUrl(fields.embedUrl)) {
    throw new ApiError(400, "허용되지 않은 임베드 주소입니다. (YouTube·치지직·SOOP·Twitch 플레이어 주소만 가능)");
  }
  const values: Record<string, unknown> = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (action === "approve") Object.assign(values, { status: "APPROVED", rejectReason: null, reviewedBy: session.userId, reviewedAt: new Date() });
  if (action === "reject") {
    if (!rejectReason) throw new ApiError(400, "반려 사유를 입력하세요.");
    Object.assign(values, { status: "REJECTED", rejectReason, isHot: false, reviewedBy: session.userId, reviewedAt: new Date() });
  }
  if (values.isHot === true && action !== "approve") {
    const [c] = await db.select({ status: clips.status }).from(clips).where(eq(clips.id, id));
    if (c.status !== "APPROVED") throw new ApiError(400, "승인된 클립만 핫 클립으로 선정할 수 있습니다.");
  }
  const row = await versionedUpdate(db, clips, id, version, values);
  await audit(`CLIP_${action.toUpperCase()}`, "clip", id, { status: row.status, isHot: row.isHot });
  const { submitterIpHash: _ip, ...clip } = row;
  void _ip;
  return { clip };
});
