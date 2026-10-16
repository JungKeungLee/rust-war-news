import "server-only";
import { createHash } from "node:crypto";
import type { DB, Tx } from "@/db";
import { mediaFiles } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

export const MAX_UPLOAD_BYTES = Math.round(Number(process.env.UPLOAD_MAX_MB ?? 3) * 1024 * 1024);
export const MAX_FILES_PER_REPORT = 3;

/**
 * 파일 형식은 클라이언트가 보낸 Content-Type 이 아니라 파일 시그니처(매직 바이트)로 판정한다.
 * SVG(스크립트 포함 가능)와 기타 형식은 거부한다.
 */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  const gif = buf.subarray(0, 6).toString("ascii");
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  return null;
}

export async function storeImage(
  db: DB | Tx,
  file: File,
  opts: { isPublic: boolean; uploadedBy?: string | null; uploaderIpHash?: string | null },
) {
  if (file.size === 0) throw new ApiError(400, "빈 파일은 업로드할 수 없습니다.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, `이미지는 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB 이하만 업로드할 수 있습니다.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(buf);
  if (!mime) throw new ApiError(415, "JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다.");
  const [row] = await db
    .insert(mediaFiles)
    .values({
      storage: "db",
      mime,
      sizeBytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
      data: buf,
      isPublic: opts.isPublic,
      uploadedBy: opts.uploadedBy ?? null,
      uploaderIpHash: opts.uploaderIpHash ?? null,
    })
    .returning({ id: mediaFiles.id });
  return row.id;
}

export const mediaUrl = (id: string) => `/api/media/${id}`;
