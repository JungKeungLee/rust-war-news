import { NextResponse, type NextRequest } from "next/server";

/**
 * 낙관적 접근 제어: 세션 쿠키가 없으면 관리자 화면 대신 로그인으로 보낸다.
 * 실제 인증·권한 검사는 관리자 레이아웃과 모든 관리자 API 에서 서버 측으로 다시 수행한다.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("rwn_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
