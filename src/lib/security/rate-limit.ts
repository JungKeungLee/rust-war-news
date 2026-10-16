import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { ApiError } from "@/lib/api/errors";

/**
 * DB 기반 고정 창 요청 제한. 서버리스 인스턴스가 여러 개여도 같은 카운터를 공유한다.
 * 한도를 넘으면 429 ApiError 를 던진다.
 */
export async function rateLimit(db: DB, key: string, limit: number, windowSeconds: number): Promise<void> {
  const res = await db.execute(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count
  `);
  const rows = (res as unknown as { rows?: { count: number }[] }).rows ?? (res as unknown as { count: number }[]);
  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) {
    throw new ApiError(429, "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  }
}
