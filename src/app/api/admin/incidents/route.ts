import { desc, eq, inArray } from "drizzle-orm";
import { incidents, incidentTeams, teams } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { IncidentFields } from "@/lib/schemas";


export const GET = adminRoute("incidents.manage", async ({ db }) => {
  const rows = await db.select().from(incidents).orderBy(incidents.isClosed, desc(incidents.updatedAt)).limit(200);
  const links = rows.length
    ? await db
        .select({ incidentId: incidentTeams.incidentId, id: teams.id, name: teams.name, color: teams.color })
        .from(incidentTeams)
        .innerJoin(teams, eq(teams.id, incidentTeams.teamId))
        .where(inArray(incidentTeams.incidentId, rows.map((r) => r.id)))
    : [];
  return { incidents: rows.map((r) => ({ ...r, teams: links.filter((l) => l.incidentId === r.id) })) };
});

export const POST = adminRoute("incidents.manage", async ({ req, db, session, audit }) => {
  const { teamIds, ...input } = await readJson(req, IncidentFields);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(incidents).values({ ...input, createdBy: session.userId }).returning();
    if (teamIds.length) await tx.insert(incidentTeams).values([...new Set(teamIds)].map((teamId) => ({ incidentId: row.id, teamId })));
    await audit("INCIDENT_CREATE", "incident", row.id, { title: row.title }, tx);
    return { incident: row };
  });
});
