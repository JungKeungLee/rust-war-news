import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { is, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { checkServerEnv } from "@/lib/env";

type Rows<T> = { rows?: T[] } | T[];
const rowsOf = <T>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

/** Drizzle 스키마에 정의된 테이블 → 컬럼 목록 */
function expectedTables(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const v of Object.values(schema)) {
    if (is(v, PgTable)) {
      const cfg = getTableConfig(v);
      out[cfg.name] = cfg.columns.map((c) => c.name);
    }
  }
  return out;
}

function expectedMigrationCount(): number | null {
  try {
    const journal = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: unknown[] };
    return journal.entries.length;
  } catch {
    return null; // 배포 번들에 drizzle 폴더가 없으면 비교 생략
  }
}

/**
 * 운영 진단: 환경변수(이름만), DB 연결, 마이그레이션 적용 수, 스키마 대비 누락 테이블·컬럼.
 * 비밀값·연결 문자열은 포함하지 않는다.
 */
export async function runHealthCheck() {
  const env = checkServerEnv();
  const result = {
    ok: false,
    env: env.map(({ name, level, message }) => ({ name, level, message })),
    db: {
      connected: false,
      latencyMs: null as number | null,
      error: null as string | null,
      migrations: { applied: null as number | null, expected: expectedMigrationCount() },
      missingTables: [] as string[],
      missingColumns: [] as string[],
    },
  };

  if (!env.some((e) => e.name === "DATABASE_URL" && e.level === "error")) {
    const started = Date.now();
    try {
      const db = await getDb();
      await db.execute(sql`select 1`);
      result.db.connected = true;
      result.db.latencyMs = Date.now() - started;

      try {
        const r = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
        result.db.migrations.applied = rowsOf<{ n: number }>(r as Rows<{ n: number }>)[0]?.n ?? 0;
      } catch {
        result.db.migrations.applied = 0;
      }

      const cols = rowsOf<{ table_name: string; column_name: string }>(
        await db.execute(sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`),
      );
      const actual = new Map<string, Set<string>>();
      for (const c of cols) {
        if (!actual.has(c.table_name)) actual.set(c.table_name, new Set());
        actual.get(c.table_name)!.add(c.column_name);
      }
      for (const [table, columns] of Object.entries(expectedTables())) {
        const have = actual.get(table);
        if (!have) result.db.missingTables.push(table);
        else for (const col of columns) if (!have.has(col)) result.db.missingColumns.push(`${table}.${col}`);
      }
    } catch (err) {
      result.db.error = classifyDbError(err);
    }
  } else {
    result.db.error = "DATABASE_URL 이 없어 연결을 시도하지 않았습니다.";
  }

  result.ok =
    !env.some((e) => e.level === "error") &&
    result.db.connected &&
    result.db.missingTables.length === 0 &&
    result.db.missingColumns.length === 0;
  return result;
}

/** 연결 실패 원인을 비밀값 없이 분류 */
function classifyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  if (/password authentication failed/i.test(msg)) return "DB 인증 실패 (사용자/비밀번호 확인)";
  if (/does not exist/i.test(msg) && /database/i.test(msg)) return "DB 이름이 존재하지 않음";
  if (/ENOTFOUND|getaddrinfo/i.test(msg)) return "DB 호스트를 찾을 수 없음 (연결 문자열 확인)";
  if (/timeout|ETIMEDOUT/i.test(msg)) return "DB 연결 시간 초과";
  return `DB 연결 오류${code ? ` (${code})` : ""}`;
}
