import { desc, eq } from "drizzle-orm";
import { articles, breakingNews, clips, incidents, incidentTeams, reports } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { zUuid, zVersion } from "@/lib/validation";
import { IncidentFields } from "@/lib/schemas";

/** 사건 상세: 연결된 제보·속보·기사·클립 */
export const GET = adminRoute<{ id: string }>("incidents.manage", async ({ db, params }) => {
  const id = zUuid.parse(params.id);
  const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
  if (!incident) throw notFound("사건");
  const [teamIds, reportRows, breakingRows, articleRows, clipRows] = await Promise.all([
    db.select({ teamId: incidentTeams.teamId }).from(incidentTeams).where(eq(incidentTeams.incidentId, id)),
    db
      .select({ id: reports.id, title: reports.title, status: reports.status, createdAt: reports.createdAt })
      .from(reports)
      .where(eq(reports.incidentId, id))
      .orderBy(desc(reports.createdAt)),
    db
      .select({ id: breakingNews.id, title: breakingNews.title, status: breakingNews.status, startsAt: breakingNews.startsAt })
      .from(breakingNews)
      .where(eq(breakingNews.incidentId, id))
      .orderBy(desc(breakingNews.createdAt)),
    db
      .select({ id: articles.id, title: articles.title, status: articles.status, publishedAt: articles.publishedAt })
      .from(articles)
      .where(eq(articles.incidentId, id))
      .orderBy(desc(articles.createdAt)),
    db.select({ id: clips.id, title: clips.title, status: clips.status }).from(clips).where(eq(clips.incidentId, id)).orderBy(desc(clips.createdAt)),
  ]);
  return { incident: { ...incident, teamIds: teamIds.map((t) => t.teamId) }, reports: reportRows, breaking: breakingRows, articles: articleRows, clips: clipRows };
});

const PatchInput = IncidentFields.extend({ version: zVersion });

export const PATCH = adminRoute<{ id: string }>("incidents.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const { version, teamIds, ...input } = await readJson(req, PatchInput);
  return db.transaction(async (tx) => {
    const row = await versionedUpdate(tx, incidents, id, version, input);
    await tx.delete(incidentTeams).where(eq(incidentTeams.incidentId, id));
    if (teamIds.length) await tx.insert(incidentTeams).values([...new Set(teamIds)].map((teamId) => ({ incidentId: id, teamId })));
    await audit("INCIDENT_UPDATE", "incident", id, { verificationStatus: row.verificationStatus, isPublic: row.isPublic, publishAt: row.publishAt }, tx);
    return { incident: { ...row, teamIds } };
  });
});
