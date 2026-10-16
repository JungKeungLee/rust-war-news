import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // drizzle-kit studio/push 용. 마이그레이션 적용은 scripts/migrate.ts 를 사용한다.
  dbCredentials: { url: process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : "postgres://localhost/rwn" },
  strict: true,
});
