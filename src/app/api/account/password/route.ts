import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { sessions, users } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";

const Input = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력하세요.").max(200),
  newPassword: z.string().max(200),
});

/**
 * 본인 비밀번호 변경 (모든 관리자 역할, 임시 비밀번호 상태에서도 허용).
 * 성공 시 임시 비밀번호 표시 해제, 다른 기기 세션 종료, 감사 로그 기록(비밀번호 값은 기록하지 않음).
 */
export const POST = adminRoute(
  "admin.access",
  async ({ req, db, session, audit }) => {
    await rateLimit(db, `pwchange:${session.userId}`, 5, 900);
    const { currentPassword, newPassword } = await readJson(req, Input);
    const policy = passwordPolicyError(newPassword);
    if (policy) throw new ApiError(400, policy);
    if (newPassword === currentPassword) throw new ApiError(400, "새 비밀번호는 현재 비밀번호와 달라야 합니다.");
    if (newPassword.toLowerCase().includes(session.email.split("@")[0].toLowerCase())) {
      throw new ApiError(400, "비밀번호에 이메일 아이디를 포함할 수 없습니다.");
    }

    const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.userId));
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      await audit("PASSWORD_CHANGE_FAILED", "user", session.userId);
      throw new ApiError(400, "현재 비밀번호가 올바르지 않습니다.");
    }

    const passwordHash = await hashPassword(newPassword);
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, session.userId));
      // 현재 세션은 유지, 다른 기기의 세션은 종료
      await tx.delete(sessions).where(and(eq(sessions.userId, session.userId), ne(sessions.id, session.sessionId)));
      await audit("PASSWORD_CHANGE", "user", session.userId, { wasTemporary: session.mustChangePassword }, tx);
    });
    return { ok: true };
  },
  { allowWhilePasswordChangeRequired: true },
);
