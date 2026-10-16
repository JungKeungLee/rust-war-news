import { and, count, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLogs, loginAttempts, users } from "@/db/schema";
import { publicRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { fakeVerify, verifyPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";

const LoginInput = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().min(1).max(200),
});

const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;
const LOCK_MINUTES = 15;

export const POST = publicRoute(async ({ req, db, ipHash }) => {
  await rateLimit(db, `login:1m:${ipHash}`, 10, 60);
  const { email, password } = await readJson(req, LoginInput);

  // 로그인 시도 제한: 15분 내 이메일당 5회, IP당 20회 실패 시 잠금
  const since = sql`now() - make_interval(mins => ${LOCK_MINUTES})`;
  const [[byEmail], [byIp]] = await Promise.all([
    db.select({ n: count() }).from(loginAttempts).where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since))),
    db.select({ n: count() }).from(loginAttempts).where(and(eq(loginAttempts.ipHash, ipHash), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since))),
  ]);
  if (byEmail.n >= MAX_FAILS_PER_EMAIL || byIp.n >= MAX_FAILS_PER_IP) {
    throw new ApiError(429, `로그인 실패가 많아 ${LOCK_MINUTES}분간 잠겼습니다. 잠시 후 다시 시도하세요.`);
  }

  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  let ok = false;
  if (user && user.isActive) ok = await verifyPassword(password, user.passwordHash);
  else await fakeVerify(); // 계정 존재 여부를 응답 시간으로 노출하지 않음

  await db.insert(loginAttempts).values({ email, ipHash, success: ok });
  if (!ok || !user) throw new ApiError(401, "이메일 또는 비밀번호가 올바르지 않습니다.");

  const { token, expiresAt } = await createSession(user.id, { ipHash, userAgent: req.headers.get("user-agent") });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await db.insert(auditLogs).values({ userId: user.id, action: "LOGIN", entityType: "user", entityId: user.id, ipHash });

  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return res;
});
