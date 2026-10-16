/**
 * 최초 관리자(SUPER_ADMIN) 생성 — 일회성
 *   ADMIN_INITIAL_EMAIL, ADMIN_INITIAL_PASSWORD, ADMIN_INITIAL_NAME 환경변수 사용
 *   이미 활성 SUPER_ADMIN 이 있으면 아무 것도 하지 않고 종료한다.
 *   실행 후 .env / Vercel 환경변수에서 ADMIN_INITIAL_PASSWORD 를 삭제하세요.
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { auditLogs, roles, userRoles, users } from "../src/db/schema";
import { hashPassword, passwordPolicyError } from "../src/lib/security/password";

async function main() {
  const email = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  const name = process.env.ADMIN_INITIAL_NAME?.trim() || "관리자";
  if (!email || !password) throw new Error("ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD 환경변수가 필요합니다.");
  const policy = passwordPolicyError(password);
  if (policy) throw new Error(policy);

  const db = await createDb(process.env.DATABASE_URL);
  const [superRole] = await db.select().from(roles).where(eq(roles.code, "SUPER_ADMIN"));
  if (!superRole) throw new Error("roles 테이블이 비어 있습니다. 먼저 npm run db:migrate 를 실행하세요.");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(eq(userRoles.roleId, superRole.id), eq(users.isActive, true)))
    .limit(1);
  if (existing.length) {
    console.log("활성 SUPER_ADMIN 계정이 이미 존재합니다. 초기화를 건너뜁니다.");
    process.exit(0);
  }

  const [dup] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (dup) throw new Error("같은 이메일의 계정이 이미 있습니다.");

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password), displayName: name })
    .returning({ id: users.id });
  await db.insert(userRoles).values({ userId: user.id, roleId: superRole.id });
  await db.insert(auditLogs).values({ userId: user.id, action: "INIT_ADMIN", entityType: "user", entityId: user.id });
  console.log(`SUPER_ADMIN 생성 완료: ${email}`);
  console.log("보안을 위해 ADMIN_INITIAL_PASSWORD 환경변수를 지금 삭제하세요.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
