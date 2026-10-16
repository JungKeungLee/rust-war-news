import { NextResponse } from "next/server";
import { runHealthCheck } from "@/server/health";

export const dynamic = "force-dynamic";

/** 배포 진단용: 환경변수 누락(이름만)·DB 연결·마이그레이션·스키마 일치 여부. 문제가 있으면 503 */
export async function GET() {
  const result = await runHealthCheck();
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
