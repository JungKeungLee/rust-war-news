import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { roles, sessions, userRoles, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { ROLE_CODES } from "@/lib/auth/permissions";
import { hashPassword, passwordPolicyError } from "@/lib/security/password";
import { zColor, zText, zUuid } from "@/lib/validation";

const Input = z.object({
  displayName: zText(30).optional(),
  color: zColor.nullable().optional(),
  isActive: z.boolean().optional(),
  roles: z.array(z.enum(ROLE_CODES)).optional(),
  password: z.string().max(200).optional(),
});

/** 계정 수정: 역할(복수)·활성 여부·비밀번호 재설정. 마지막 최고 관리자는 강등·비활성화할 수 없다. */
export const PATCH = adminRoute<{ id: string }>("users.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, Input);
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw notFound("계정");

  return db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.displayName !== undefined) values.displayName = input.displayName;
    if (input.color !== undefined) values.color = input.color;
    if (input.isActive !== undefined) values.isActive = input.isActive;
    if (input.password) {
      const policy = passwordPolicyError(input.password);
      if (policy) throw new ApiError(400, policy);
      values.passwordHash = await hashPassword(input.password);
    }
    await tx.update(users).set(values).where(eq(users.id, id));

    if (input.roles) {
      const roleRows = await tx.select().from(roles).where(inArray(roles.code, input.roles));
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      if (roleRows.length) await tx.insert(userRoles).values(roleRows.map((r) => ({ userId: id, roleId: r.id })));
    }

    // 활성 SUPER_ADMIN 이 최소 1명 남아 있어야 한다
    const [{ n }] = await tx
      .select({ n: count() })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(roles.code, "SUPER_ADMIN"), eq(users.isActive, true)));
    if (n === 0) throw new ApiError(409, "활성 최고 관리자가 최소 1명은 있어야 합니다.");

    // 비활성화·비밀번호 변경·역할 변경 시 기존 세션 무효화
    if (input.isActive === false || input.password || input.roles) await tx.delete(sessions).where(eq(sessions.userId, id));
    await audit("USER_UPDATE", "user", id, { isActive: input.isActive, roles: input.roles, passwordReset: !!input.password }, tx);
    return { ok: true };
  });
});

