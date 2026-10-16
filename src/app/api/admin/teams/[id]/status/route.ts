import { eq } from "drizzle-orm";
import { z } from "zod";
import { incidents, teams } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { TEAM_STATUS } from "@/lib/labels";
import { zOptText, zOptUuid, zUuid, zVersion } from "@/lib/validation";

const Input = z.object({
  version: zVersion,
  status: z.enum(TEAM_STATUS),
  message: zOptText(300, true),
  isPublic: z.boolean(),
  incidentId: zOptUuid,
});

/**
 * 팀별 지통실 공개 상태 변경 (최고 관리자·편집자·운영자·진행자).
 * teams.version 으로 동시 수정 충돌을 막고, 변경 전/후를 감사 로그에 남긴다.
 */
export const PATCH = adminRoute<{ id: string }>("teamstatus.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, Input);
  const [before] = await db.select().from(teams).where(eq(teams.id, id));
  if (!before) throw notFound("팀");
  if (input.incidentId) {
    const [inc] = await db.select({ id: incidents.id }).from(incidents).where(eq(incidents.id, input.incidentId));
    if (!inc) throw new ApiError(400, "연결할 사건을 찾을 수 없습니다.");
  }
  return db.transaction(async (tx) => {
    const row = await versionedUpdate(tx, teams, id, input.version, {
      publicStatus: input.status,
      statusMessage: input.message,
      statusIsPublic: input.isPublic,
      statusIncidentId: input.incidentId,
      statusUpdatedBy: session.userId,
      statusUpdatedAt: new Date(),
    });
    await audit(
      "TEAM_STATUS_UPDATE",
      "team",
      id,
      {
        from: { status: before.publicStatus, isPublic: before.statusIsPublic, message: before.statusMessage, incidentId: before.statusIncidentId },
        to: { status: row.publicStatus, isPublic: row.statusIsPublic, message: row.statusMessage, incidentId: row.statusIncidentId },
      },
      tx,
    );
    return { team: row };
  });
});
