import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { roles, userRoles, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { hashPassword, passwordPolicyError } from "@/lib/security/password";
import { zColor, zText } from "@/lib/validation";

export const GET = adminRoute("users.manage", async ({ db }) => {
  const list = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, color: users.color, isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt));
  const roleRows = await db.select({ userId: userRoles.userId, code: roles.code }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId));
  return { users: list.map((u) => ({ ...u, roles: roleRows.filter((r) => r.userId === u.id).map((r) => r.code) })) };
});

const CreateInput = z.object({
  email: z.email("이메일 형식이 올바르지 않습니다.").transform((s) => s.trim().toLowerCase()),
  displayName: zText(30),
  password: z.string().max(200),
  color: zColor.nullable().optional(),
  roles: z.array(z.enum(ROLE_CODES)).min(1, "역할을 하나 이상 선택하세요."),
});

/** 관리자 계정 생성 (SUPER_ADMIN 전용) */
export const POST = adminRoute("users.manage", async ({ req, db, audit }) => {
  const input = await readJson(req, CreateInput);
  const policy = passwordPolicyError(input.password);
  if (policy) throw new ApiError(400, policy);
  const [dup] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`);
  if (dup) throw new ApiError(409, "이미 사용 중인 이메일입니다.");
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email: input.email, displayName: input.displayName, passwordHash, color: input.color ?? null })
      .returning({ id: users.id });
    const roleRows = await tx.select().from(roles).where(inArray(roles.code, input.roles));
    await tx.insert(userRoles).values(roleRows.map((r) => ({ userId: u.id, roleId: r.id })));
    await audit("USER_CREATE", "user", u.id, { email: input.email, roles: input.roles }, tx);
    return { id: u.id };
  });
});
