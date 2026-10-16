import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { roles, sessions, userRoles, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { hashPassword, passwordPolicyError } from "@/lib/security/password";
import { maskEmail } from "@/lib/privacy";
import { zColor, zText, zUuid } from "@/lib/validation";

const Input = z.object({
  email: z
    .email("이메일 형식이 올바르지 않습니다.")
    .max(200)
    .transform((s) => s.trim().toLowerCase())
    .optional(),
  displayName: zText(30).optional(),
  color: zColor.nullable().optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.enum(ROLE_CODES)).optional(),
  password: z.string().max(200).optional(),
});

/**
 * 계정 수정 (SUPER_ADMIN 전용): 이메일·표시 이름·색상·활성 여부·역할(복수)·비밀번호 재설정.
 *  - 사용자 ID 는 바뀌지 않으므로 기사·큐시트·대본·감사 로그 연결은 그대로 유지된다.
 *  - 다른 사람의 비밀번호를 재설정하면 임시 비밀번호로 표시되어 다음 로그인 때 변경을 요구한다.
 *  - 마지막 활성 최고 관리자는 강등·비활성화할 수 없다.
 *  - 감사 로그에는 이메일을 마스킹해서, 비밀번호는 "재설정 여부"만 기록한다.
 */
export const PATCH = adminRoute<{ id: string }>("users.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, Input);
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw notFound("계정");

  if (input.email && input.email !== user.email.toLowerCase()) {
    const [dup] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${input.email}`, ne(users.id, id)));
    if (dup) throw new ApiError(409, "이미 다른 계정이 사용 중인 이메일입니다.");
  }

  let passwordHash: string | undefined;
  if (input.password) {
    const policy = passwordPolicyError(input.password);
    if (policy) throw new ApiError(400, policy);
    passwordHash = await hashPassword(input.password);
  }

  return db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    const changes: Record<string, unknown> = {};
    if (input.email !== undefined && input.email !== user.email.toLowerCase()) {
      values.email = input.email;
      changes.email = { from: maskEmail(user.email), to: maskEmail(input.email) };
    }
    if (input.displayName !== undefined && input.displayName !== user.displayName) {
      values.displayName = input.displayName;
      changes.displayName = { from: user.displayName, to: input.displayName };
    }
    if (input.color !== undefined) values.color = input.color;
    if (input.isActive !== undefined && input.isActive !== user.isActive) {
      values.isActive = input.isActive;
      changes.isActive = input.isActive;
    }
    if (passwordHash) {
      values.passwordHash = passwordHash;
      // 본인이 아닌 계정의 재설정 = 관리자가 알려주는 임시 비밀번호
      values.mustChangePassword = id !== session.userId;
      values.passwordChangedAt = new Date();
      changes.passwordReset = true;
      changes.temporary = id !== session.userId;
    }
    await tx.update(users).set(values).where(eq(users.id, id));

    if (input.roles) {
      const before = (
        await tx.select({ code: roles.code }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, id))
      ).map((r) => r.code);
      const roleRows = await tx.select().from(roles).where(inArray(roles.code, input.roles));
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      if (roleRows.length) await tx.insert(userRoles).values(roleRows.map((r) => ({ userId: id, roleId: r.id })));
      changes.roles = { from: before, to: input.roles };
    }

    // 활성 SUPER_ADMIN 이 최소 1명 남아 있어야 한다
    const [{ n }] = await tx
      .select({ n: count() })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(roles.code, "SUPER_ADMIN"), eq(users.isActive, true)));
    if (n === 0) throw new ApiError(409, "활성 최고 관리자가 최소 1명은 있어야 합니다.");

    // 비활성화·비밀번호 재설정·역할 변경 시 기존 세션 무효화 (이메일 변경은 로그인 ID 변경이므로 세션 유지)
    if (input.isActive === false || passwordHash || input.roles) await tx.delete(sessions).where(eq(sessions.userId, id));
    if (Object.keys(changes).length) await audit("USER_UPDATE", "user", id, changes, tx);
    return { ok: true };
  });
});
