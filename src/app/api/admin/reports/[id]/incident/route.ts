import { eq } from "drizzle-orm";
import { z } from "zod";
import { incidents, incidentTeams, reports, reportTeams } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { zOptUuid, zText, zUuid, zVersion } from "@/lib/validation";

const Input = z.object({ version: zVersion, title: zText(150).optional(), eventId: zOptUuid.optional() });

/** 제보로부터 새 사건을 만들고 제보를 연결한다 (사건 기본값: 비공개·미확인) */
export const POST = adminRoute<{ id: string }>("incidents.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, Input);
  const [report] = await db.select().from(reports).where(eq(reports.id, id));
  if (!report) throw notFound("제보");
  const teamRows = await db.select({ teamId: reportTeams.teamId }).from(reportTeams).where(eq(reportTeams.reportId, id));

  return db.transaction(async (tx) => {
    const [incident] = await tx
      .insert(incidents)
      .values({
        title: input.title ?? report.title,
        type: report.type,
        occurredAt: report.occurredAt,
        eventId: input.eventId ?? null,
        verificationStatus: "VERIFYING",
        isPublic: false,
        isSensitive: report.isSensitive,
        createdBy: session.userId,
      })
      .returning();
    if (teamRows.length) await tx.insert(incidentTeams).values(teamRows.map((t) => ({ incidentId: incident.id, teamId: t.teamId })));
    const updated = await versionedUpdate(tx, reports, id, input.version, {
      incidentId: incident.id,
      status: report.status === "RECEIVED" ? "REVIEWING" : report.status,
    });
    await audit("INCIDENT_CREATE_FROM_REPORT", "incident", incident.id, { reportId: id }, tx);
    return { incident, reportVersion: updated.version };
  });
});
