import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { createDb } from "./client";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __rwnDb?: Promise<DB> };

/** 프로세스당 하나의 DB 커넥션 풀을 공유한다 (개발 모드 HMR 포함). */
export function getDb(): Promise<DB> {
  if (!globalForDb.__rwnDb) {
    globalForDb.__rwnDb = createDb(process.env.DATABASE_URL).catch((err) => {
      globalForDb.__rwnDb = undefined;
      throw err;
    });
  }
  return globalForDb.__rwnDb;
}

export { schema };
