/**
 * 진행자(ANCHOR) 계정 기본 등록 — 이름은 코드가 아니라 SEED_ANCHORS 환경변수로 받는다.
 *   SEED_ANCHORS="난워니:nanwony@example.com,김옥독:kimokdok@example.com"
 * 이미 같은 이메일이 있으면 ANCHOR 역할만 보장한다. 새 계정의 임시 비밀번호는 한 번만 출력된다.
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { roles, userRoles, users } from "../src/db/schema";
import { generatePassword, hashPassword } from "../src/lib/security/password";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

async function main() {
  const raw = process.env.SEED_ANCHORS?.trim();
  if (!raw) throw new Error('SEED_ANCHORS="이름:이메일,이름:이메일" 형식으로 지정하세요.');
  const db = await createDb(process.env.DATABASE_URL);
  const [anchorRole] = await db.select().from(roles).where(eq(roles.code, "ANCHOR"));
  if (!anchorRole) throw new Error("먼저 npm run db:migrate 를 실행하세요.");

  const entries = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [i, entry] of entries.entries()) {
    const [name, emailRaw] = entry.split(":").map((s) => s?.trim());
    const email = emailRaw?.toLowerCase();
    if (!name || !email) throw new Error(`형식 오류: ${entry}`);
    let [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    if (!user) {
      const password = generatePassword();
      [user] = await db
        .insert(users)
        .values({ email, displayName: name, passwordHash: await hashPassword(password), color: COLORS[i % COLORS.length], mustChangePassword: true })
        .returning();
      console.log(`진행자 생성: ${name} <${email}> 임시 비밀번호: ${password}  (첫 로그인 시 변경 필수)`);
    } else {
      console.log(`기존 계정 사용: ${user.displayName} <${email}>`);
    }
    await db.insert(userRoles).values({ userId: user.id, roleId: anchorRole.id }).onConflictDoNothing();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
