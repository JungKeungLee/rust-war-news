/**
 * 읽기 전용 DB 점검: 연결 대상(호스트·DB 이름), 서버 버전, public 테이블 수, 적용된 마이그레이션 수.
 * 비밀번호·연결 문자열 전체는 출력하지 않는다.
 *   DOTENV_CONFIG_PATH=.env.neon npm run db:info
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client";

const rowsOf = <T>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("pglite:")) {
    console.log(`대상: 로컬 PGlite (${url}) — Neon 이 아닙니다.`);
  } else {
    const u = new URL(url);
    console.log(`대상 호스트: ${u.hostname}`);
    console.log(`대상 DB 이름: ${u.pathname.replace(/^\//, "")}`);
    console.log(`Neon 호스트 여부: ${u.hostname.endsWith(".neon.tech") ? "예" : "아니오"} / 풀러(pooler) 사용: ${u.hostname.includes("-pooler") ? "예" : "아니오"}`);
  }
  const db = await createDb(url);
  const [info] = rowsOf<{ db: string; version: string }>(await db.execute(sql`select current_database() as db, version() as version`));
  console.log(`접속 확인: current_database()=${info.db}`);
  console.log(`서버: ${info.version.split(",")[0]}`);
  const [t] = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`));
  console.log(`public 테이블 수: ${t.n}`);
  let applied: number | string = "마이그레이션 기록 없음";
  try {
    applied = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`))[0].n;
  } catch {
    /* 아직 마이그레이션 전 */
  }
  console.log(`적용된 마이그레이션: ${applied}`);
  process.exit(0);
}

main().catch((err) => {
  // 오류 메시지에 연결 문자열이 섞여 나오지 않도록 자격 증명 부분을 가린다
  console.error(String(err instanceof Error ? err.message : err).replace(/\/\/[^@\s]*@/g, "//***@"));
  process.exit(1);
});
