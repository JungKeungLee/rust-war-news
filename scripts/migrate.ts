/**
 * 마이그레이션 적용 스크립트 (비파괴 기본값)
 *   npm run db:migrate                         → 미적용 마이그레이션만 적용
 *   npm run db:migrate -- --dry-run            → 적용 예정 목록만 출력
 *   npm run db:migrate -- --allow-destructive  → DROP/TRUNCATE 등이 포함된 마이그레이션도 허용
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client";

const args = new Set(process.argv.slice(2));
const DESTRUCTIVE =
  /\b(DROP\s+(TABLE|COLUMN|SCHEMA|TYPE|INDEX|CONSTRAINT)|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE)\b/i;

function rowsOf<T>(res: unknown): T[] {
  const r = res as { rows?: T[] };
  return Array.isArray(r.rows) ? r.rows : (res as T[]);
}

async function main() {
  const url = process.env.DATABASE_URL;
  const db = await createDb(url);
  const folder = path.resolve("drizzle");
  const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8")) as {
    entries: { tag: string; when: number }[];
  };

  let lastApplied = 0;
  try {
    const res = await db.execute(sql`select max(created_at) as last from drizzle.__drizzle_migrations`);
    lastApplied = Number(rowsOf<{ last: string | number | null }>(res)[0]?.last ?? 0);
  } catch {
    lastApplied = 0; // 마이그레이션 테이블 없음 = 신규 DB
  }

  const pending = journal.entries.filter((e) => e.when > lastApplied);
  console.log(`대상 DB: ${url?.startsWith("pglite:") ? url : (url ?? "").replace(/\/\/[^@]*@/, "//***@")}`);
  if (pending.length === 0) {
    console.log("적용할 마이그레이션이 없습니다.");
    process.exit(0);
  }
  console.log("적용 예정:", pending.map((p) => p.tag).join(", "));

  const destructive = pending.filter((p) => DESTRUCTIVE.test(readFileSync(path.join(folder, `${p.tag}.sql`), "utf8")));
  if (destructive.length && !args.has("--allow-destructive")) {
    console.error(
      `\n[중단] 파괴적 변경(DROP/TRUNCATE/DELETE/타입 변경)이 포함된 마이그레이션: ${destructive.map((d) => d.tag).join(", ")}\n` +
        "운영 DB라면 백업 후 승인을 받고 --allow-destructive 옵션으로 다시 실행하세요.",
    );
    process.exit(2);
  }
  if (args.has("--dry-run")) process.exit(0);

  if (url!.startsWith("pglite:")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    await migrate(db as never, { migrationsFolder: folder });
  }
  console.log("마이그레이션 완료");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
