import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { getDb, type DB, type Tx } from "@/db";
import { auditLogs } from "@/db/schema";
import { loadSessionByToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ipHash, isSameOrigin } from "@/lib/security/request";
import { safeErrorForLog } from "@/lib/privacy";
import { ApiError, ConflictError, notFound } from "./errors";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_JSON_BYTES = 200 * 1024;

type RouteCtx<P> = { params: Promise<P> };

export type PublicCtx<P> = { req: NextRequest; params: P; db: DB; ipHash: string };
export type AdminCtx<P> = PublicCtx<P> & {
  session: SessionUser;
  audit: (action: string, entityType: string, entityId?: string | null, detail?: Record<string, unknown>, tx?: Tx) => Promise<void>;
};

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status, headers: { "Cache-Control": "no-store" } });
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join(".");
    return NextResponse.json(
      { error: issue ? `${field ? field + ": " : ""}${issue.message}` : "입력값이 올바르지 않습니다.", issues: err.issues.slice(0, 10) },
      { status: 400 },
    );
  }
  const pgCode = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  if (pgCode === "23505") return NextResponse.json({ error: "이미 존재하는 항목입니다." }, { status: 409 });
  if (pgCode === "23503") return NextResponse.json({ error: "연결된 데이터가 있어 처리할 수 없거나 참조 대상이 없습니다." }, { status: 409 });
  // 원본 오류에는 쿼리 파라미터(비밀번호 해시·이메일 등)가 들어 있을 수 있어 요약본만 기록
  console.error("[api]", JSON.stringify(safeErrorForLog(err)));
  return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_JSON_BYTES) throw new ApiError(413, "요청 본문이 너무 큽니다.");
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new ApiError(413, "요청 본문이 너무 큽니다.");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "JSON 형식이 올바르지 않습니다.");
  }
  return schema.parse(data);
}

/** 공개 API. 상태 변경 요청은 동일 출처만 허용한다. */
/**
 * 공개 API. 상태 변경 요청은 동일 출처만 허용한다.
 * opts.cacheSeconds 를 주면(GET 전용) 폴링 부하를 줄이기 위해
 *  - 내용 기반 ETag (serverTime 제외) → 변경 없으면 304, 본문 없음
 *  - CDN 공유 캐시 s-maxage=N (+ stale-while-revalidate) → 시청자가 많아도 DB 조회는 N초당 1회 수준
 * 최대 반영 지연 = 폴링 주기 + N초. 실시간성이 중요한 엔드포인트는 N 을 작게 유지한다.
 */
export function publicRoute<P = Record<string, string>>(fn: (ctx: PublicCtx<P>) => Promise<unknown>, opts: { cacheSeconds?: number } = {}) {
  return async (req: NextRequest, ctx: RouteCtx<P>) => {
    try {
      if (MUTATING.has(req.method) && !isSameOrigin(req)) throw new ApiError(403, "허용되지 않은 요청 출처입니다.");
      const db = await getDb();
      const result = await fn({ req, params: await ctx.params, db, ipHash: ipHash(req.headers) });
      if (!opts.cacheSeconds || req.method !== "GET" || result instanceof Response) return toResponse(result);
      return cachedJson(req, result, opts.cacheSeconds);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function cachedJson(req: NextRequest, payload: unknown, seconds: number): Response {
  const { serverTime: _t, ...content } = (payload ?? {}) as Record<string, unknown>;
  void _t;
  const tag = `W/"${createHash("sha1").update(JSON.stringify(content)).digest("base64url")}"`;
  const headers = {
    ETag: tag,
    "Cache-Control": `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
    Vary: "Accept-Encoding",
  };
  if (req.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers });
  return NextResponse.json(payload, { headers });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * 관리자 API. 세션 인증 → 권한 확인 → (상태 변경 시) Origin + CSRF 토큰 검사 순으로 처리한다.
 */
export function adminRoute<P = Record<string, string>>(
  perm: Permission,
  fn: (ctx: AdminCtx<P>) => Promise<unknown>,
  opts: { allowWhilePasswordChangeRequired?: boolean } = {},
) {
  return async (req: NextRequest, ctx: RouteCtx<P>) => {
    try {
      const session = await loadSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
      if (!session) throw new ApiError(401, "로그인이 필요합니다.");
      // 임시 비밀번호 계정은 비밀번호를 바꾸기 전까지 다른 관리자 기능을 쓸 수 없다
      if (session.mustChangePassword && !opts.allowWhilePasswordChangeRequired) {
        throw new ApiError(403, "임시 비밀번호입니다. 먼저 비밀번호를 변경하세요.", { code: "PASSWORD_CHANGE_REQUIRED" });
      }
      if (!hasPermission(session.roles, perm)) throw new ApiError(403, "이 작업을 수행할 권한이 없습니다.");
      if (MUTATING.has(req.method)) {
        if (!isSameOrigin(req)) throw new ApiError(403, "허용되지 않은 요청 출처입니다.");
        const token = req.headers.get("x-csrf-token") ?? "";
        if (!safeEqual(token, session.csrfToken)) throw new ApiError(403, "CSRF 토큰이 유효하지 않습니다. 페이지를 새로고침하세요.");
      }
      const db = await getDb();
      const ip = ipHash(req.headers);
      const audit: AdminCtx<P>["audit"] = async (action, entityType, entityId, detail, tx) => {
        await (tx ?? db).insert(auditLogs).values({
          userId: session.userId,
          action,
          entityType,
          entityId: entityId ?? null,
          detail: detail ?? null,
          ipHash: ip,
        });
      };
      return toResponse(await fn({ req, params: await ctx.params, db, ipHash: ip, session, audit }));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

type VersionedTable = PgTable & { id: PgColumn; version: PgColumn; updatedAt?: PgColumn };

/**
 * 낙관적 잠금 업데이트: WHERE id = ? AND version = ? 로 갱신하고 version 을 1 올린다.
 * 영향 행이 없으면 현재 행과 함께 409 ConflictError 를 던진다.
 */
export async function versionedUpdate<T extends VersionedTable>(
  db: DB | Tx,
  table: T,
  id: string,
  expectedVersion: number,
  values: Record<string, unknown>,
  extraWhere?: SQL,
): Promise<T["$inferSelect"]> {
  const set: Record<string, unknown> = { ...values, version: sql`${table.version} + 1` };
  if ("updatedAt" in table && table.updatedAt) set.updatedAt = new Date();
  const where = and(eq(table.id, id), eq(table.version, expectedVersion), extraWhere);
  const rows = (await db.update(table).set(set as never).where(where).returning()) as T["$inferSelect"][];
  if (rows[0]) return rows[0];
  const current = (await db.select().from(table as PgTable).where(eq(table.id, id)).limit(1)) as T["$inferSelect"][];
  if (!current[0]) throw notFound();
  throw new ConflictError(current[0]);
}
