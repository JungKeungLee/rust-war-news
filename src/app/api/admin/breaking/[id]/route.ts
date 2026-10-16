import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { breakingNews, breakingRevisions, users } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { BreakingFields } from "@/lib/schemas";
import { zOptText, zUuid, zVersion } from "@/lib/validation";

/** 속보 정정 이력 */
export const GET = adminRoute<{ id: string }>("breaking.manage", async ({ db, params }) => {
  const id = zUuid.parse(params.id);
  const [b] = await db.select().from(breakingNews).where(eq(breakingNews.id, id));
  if (!b) throw notFound("속보");
  const revisions = await db
    .select({ rev: breakingRevisions, userName: users.displayName })
    .from(breakingRevisions)
    .leftJoin(users, eq(users.id, breakingRevisions.userId))
    .where(eq(breakingRevisions.breakingId, id))
    .orderBy(asc(breakingRevisions.createdAt));
  return { breaking: b, revisions: revisions.map((r) => ({ ...r.rev, userName: r.userName })) };
});

const PatchInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), version: zVersion }),
  z.object({ action: z.literal("end"), version: zVersion }),
  z.object({ action: z.literal("cancel"), version: zVersion, note: zOptText(300, true) }),
  z.object({ action: z.literal("pin"), version: zVersion, value: z.boolean() }),
  z.object({ action: z.literal("overlay"), version: zVersion, value: z.boolean() }),
  z.object({
    action: z.literal("correct"),
    version: zVersion,
    title: BreakingFields.shape.title,
    body: BreakingFields.shape.body,
    verificationStatus: BreakingFields.shape.verificationStatus,
    note: zOptText(300, true),
  }),
  BreakingFields.extend({ action: z.literal("update"), version: zVersion }),
]);

/**
 * 속보 상태 변경. 모든 변경은 version 검사(낙관적 잠금)를 거치며 이력이 남는다.
 *  - publish: 즉시 송출(시작 시각이 미래면 예약)
 *  - end: 송출 종료 → 공개 페이지·OBS 에서 즉시 제거
 *  - cancel: 취소(오보 등)
 *  - correct: 송출 중 정정 — 원문은 이력에 보존, 화면에 [정정] 표시
 */
export const PATCH = adminRoute<{ id: string }>("breaking.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, PatchInput);
  const [current] = await db.select().from(breakingNews).where(eq(breakingNews.id, id));
  if (!current) throw notFound("속보");
  const now = new Date();
  const values: Record<string, unknown> = {};
  let revAction = input.action.toUpperCase();
  let note: string | null = null;

  switch (input.action) {
    case "publish": {
      if (!["DRAFT", "SCHEDULED"].includes(current.status)) throw new ApiError(409, "작성 중이거나 예약된 속보만 발행할 수 있습니다.");
      const future = current.startsAt && current.startsAt > now;
      values.status = future ? "SCHEDULED" : "LIVE";
      if (!future) values.startsAt = now;
      values.publishedAt = now;
      if (current.endsAt && current.endsAt <= now) values.endsAt = null;
      break;
    }
    case "end":
      if (["ENDED", "CANCELLED"].includes(current.status)) throw new ApiError(409, "이미 종료된 속보입니다.");
      values.status = "ENDED";
      values.endedAt = now;
      values.endsAt = now;
      break;
    case "cancel":
      values.status = "CANCELLED";
      values.endedAt = now;
      values.endsAt = now;
      note = input.note ?? null;
      break;
    case "pin":
      values.isPinned = input.value;
      revAction = input.value ? "PIN" : "UNPIN";
      break;
    case "overlay":
      values.showOnOverlay = input.value;
      revAction = input.value ? "OVERLAY_ON" : "OVERLAY_OFF";
      break;
    case "correct":
      if (current.status === "DRAFT") throw new ApiError(409, "발행 전 속보는 수정 기능을 사용하세요.");
      values.title = input.title;
      values.body = input.body;
      values.verificationStatus = input.verificationStatus;
      values.correctedAt = now;
      values.correctionNote = input.note;
      note = input.note;
      break;
    case "update": {
      if (!["DRAFT", "SCHEDULED"].includes(current.status)) throw new ApiError(409, "송출 중인 속보는 '정정'으로 수정하세요.");
      const { action: _a, version: _v, ...fields } = input;
      void _a;
      void _v;
      if (fields.endsAt && fields.startsAt && fields.endsAt <= fields.startsAt) throw new ApiError(400, "노출 종료 시각은 시작 시각 이후여야 합니다.");
      Object.assign(values, fields);
      break;
    }
  }

  return db.transaction(async (tx) => {
    const row = await versionedUpdate(tx, breakingNews, id, input.version, values);
    await tx.insert(breakingRevisions).values({ breakingId: id, action: revAction, title: row.title, body: row.body, note, userId: session.userId });
    await audit(`BREAKING_${revAction}`, "breaking", id, { status: row.status, title: row.title }, tx);
    return { breaking: row };
  });
});
