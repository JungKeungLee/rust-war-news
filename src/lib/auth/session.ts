import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { roles, sessions, userRoles, users } from "@/db/schema";
import { hasPermission, type Permission, type RoleCode } from "./permissions";

export const SESSION_COOKIE = "rwn_session";
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionUser = {
  sessionId: string;
  csrfToken: string;
  userId: string;
  email: string;
  displayName: string;
  color: string | null;
  roles: RoleCode[];
  /** 임시 비밀번호 상태면 true — 비밀번호 변경 외 기능 차단 */
  mustChangePassword: boolean;
};

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string, meta: { ipHash: string; userAgent: string | null }) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    csrfToken,
    expiresAt,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  return { token, expiresAt, csrfToken };
}

export async function loadSessionByToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const id = sha256(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      csrfToken: sessions.csrfToken,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      color: users.color,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  const row = rows[0];
  if (!row || !row.isActive) return null;

  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, row.userId));

  if (Date.now() - new Date(row.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
  }

  return {
    sessionId: row.sessionId,
    csrfToken: row.csrfToken,
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    color: row.color,
    roles: roleRows.map((r) => r.code),
    mustChangePassword: row.mustChangePassword,
  };
}

/** 서버 컴포넌트용: 현재 요청의 세션 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return loadSessionByToken(jar.get(SESSION_COOKIE)?.value);
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

/** 비밀번호 변경 시: 현재 세션만 남기고 다른 기기 세션 모두 종료 */
export async function destroyOtherSessions(userId: string, keepSessionId: string) {
  const db = await getDb();
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
}

export async function destroyUserSessions(userId: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function can(session: SessionUser | null, perm: Permission): boolean {
  return !!session && hasPermission(session.roles, perm);
}
