import { asc, desc } from "drizzle-orm";
import { events, players, teamMembers, teams } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { TeamFields } from "@/lib/schemas";

/** 대결(시즌)·팀·선수·소속 전체 */
export const GET = adminRoute("teams.manage", async ({ db }) => {
  const [eventRows, teamRows, playerRows, memberRows] = await Promise.all([
    db.select().from(events).orderBy(desc(events.isActive), desc(events.createdAt)),
    db.select().from(teams).orderBy(asc(teams.name)),
    db.select().from(players).orderBy(asc(players.nickname)),
    db.select().from(teamMembers),
  ]);
  return { events: eventRows, teams: teamRows, players: playerRows, members: memberRows };
});

export const POST = adminRoute("teams.manage", async ({ req, db, audit }) => {
  const input = await readJson(req, TeamFields);
  const [row] = await db.insert(teams).values(input).returning();
  await audit("TEAM_CREATE", "team", row.id, { name: row.name });
  return { team: row };
});

