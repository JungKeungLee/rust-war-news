import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * DATABASE_URL 형식
 *  - postgres://... / postgresql://...  → Neon PostgreSQL (WebSocket Pool, 트랜잭션 지원)
 *  - pglite:./.pglite                   → 로컬 개발·테스트용 내장 PostgreSQL (PGlite)
 */
export async function createDb(url: string | undefined): Promise<AnyDb> {
  if (!url) throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");

  if (url.startsWith("pglite:")) {
    const dir = url.slice("pglite:".length) || "./.pglite";
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(dir);
    await client.waitReady;
    return drizzle(client, { schema }) as unknown as AnyDb;
  }

  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  if (typeof globalThis.WebSocket === "undefined") {
    const ws = await import("ws");
    neonConfig.webSocketConstructor = ws.default;
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  return drizzle(pool, { schema }) as unknown as AnyDb;
}
