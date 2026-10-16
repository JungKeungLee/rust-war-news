import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaFiles } from "@/db/schema";
import { loadSessionByToken, SESSION_COOKIE } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import type { NextRequest } from "next/server";

/**
 * 업로드 이미지 제공. 비공개 파일(미승인 제보 증거)은 관리자 세션이 있어야만 열람 가능.
 * 저장 시 매직 바이트로 판정한 MIME 만 사용하고, 스니핑·스크립트 실행을 막는 헤더를 붙인다.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [m] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id));
  if (!m || !m.data) return new Response("Not found", { status: 404 });

  if (!m.isPublic) {
    const session = await loadSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session || !hasPermission(session.roles, "admin.access")) return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(m.data.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cache-Control": m.isPublic ? "public, max-age=3600" : "private, no-store",
    },
  });
}
