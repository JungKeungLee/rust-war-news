import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { episodeAnchors, episodes, roles, userRoles, users } from "@/db/schema";
import { ApiError, ConflictError, notFound } from "@/lib/api/errors";

/** ANCHOR 역할 사용자만 진행자로 배정 가능 */
export async function assertAnchors(tx: Tx, ids: string[]) {
  if (!ids.length) return;
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(inArray(users.id, ids), eq(roles.code, "ANCHOR"), eq(users.isActive, true)));
  if (rows.length !== new Set(ids).size) throw new ApiError(400, "진행자(ANCHOR) 역할이 있는 활성 계정만 배정할 수 있습니다.");
}

export async function setEpisodeAnchors(tx: Tx, episodeId: string, ids: string[]) {
  await tx.delete(episodeAnchors).where(eq(episodeAnchors.episodeId, episodeId));
  const unique = [...new Set(ids)];
  if (unique.length) await tx.insert(episodeAnchors).values(unique.map((userId, position) => ({ episodeId, userId, position })));
}

/**
 * 큐시트 구조 변경(추가·삭제·순서 변경·진행 이동) 시 회차 행을 잠그고 버전을 검사한다.
 * expectedVersion 이 없으면 잠금만 하고 버전 검사는 생략한다.
 */
export async function lockEpisode(tx: Tx, episodeId: string, expectedVersion?: number) {
  const [ep] = await tx.select().from(episodes).where(eq(episodes.id, episodeId)).for("update");
  if (!ep) throw notFound("방송 회차");
  if (expectedVersion !== undefined && ep.version !== expectedVersion) throw new ConflictError({ episodeVersion: ep.version });
  return ep;
}

export async function bumpEpisode(tx: Tx, episodeId: string, values: Record<string, unknown> = {}) {
  const [ep] = await tx
    .update(episodes)
    .set({ ...values, version: sql`${episodes.version} + 1`, updatedAt: new Date() })
    .where(eq(episodes.id, episodeId))
    .returning();
  return ep;
}
