import { adminRoute } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { MAX_UPLOAD_BYTES, mediaUrl, storeImage } from "@/lib/media";
import { rateLimit } from "@/lib/security/rate-limit";

/** 관리자 이미지 업로드 (팀 로고, 기사 커버 등 공개 이미지) */
export const POST = adminRoute("admin.access", async ({ req, db, session, audit }) => {
  await rateLimit(db, `admin-upload:${session.userId}`, 60, 3600);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) throw new ApiError(413, "파일이 너무 큽니다.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "파일이 없습니다.");
  const id = await storeImage(db, file, { isPublic: true, uploadedBy: session.userId });
  await audit("MEDIA_UPLOAD", "media", id, { size: file.size });
  return { id, url: mediaUrl(id) };
});
