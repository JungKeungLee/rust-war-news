import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events, incidents, incidentTeams, teams, users } from "@/db/schema";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { TeamStatusManager } from "@/components/admin/TeamStatusManager";

export const metadata = { title: "팀별 지통실 관리" };

export default async function TeamStatusPage() {
  if (!(await requirePagePermission("teamstatus.manage"))) return <Forbidden />;
  const db = await getDb();
  const [teamRows, links, incidentRows] = await Promise.all([
    db
      .select({ team: teams, eventName: events.name, eventActive: events.isActive, updaterName: users.displayName })
      .from(teams)
      .innerJoin(events, eq(events.id, teams.eventId))
      .leftJoin(users, eq(users.id, teams.statusUpdatedBy))
      .orderBy(desc(events.isActive), asc(teams.name)),
    db.select({ incidentId: incidentTeams.incidentId, teamId: incidentTeams.teamId }).from(incidentTeams),
    db
      .select({ id: incidents.id, title: incidents.title, isPublic: incidents.isPublic, verificationStatus: incidents.verificationStatus })
      .from(incidents)
      .orderBy(desc(incidents.updatedAt))
      .limit(300),
  ]);

  const data = teamRows.map(({ team, eventName, eventActive, updaterName }) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    isPublic: team.isPublic,
    eventName,
    eventActive,
    version: team.version,
    status: team.publicStatus,
    message: team.statusMessage,
    statusIsPublic: team.statusIsPublic,
    incidentId: team.statusIncidentId,
    updatedAt: team.statusUpdatedAt?.toISOString() ?? null,
    updaterName,
    teamIncidentIds: links.filter((l) => l.teamId === team.id).map((l) => l.incidentId),
  }));

  return (
    <>
      <AdminTitle
        title="팀별 지통실 관리"
        desc="공개 지통실(/control-room)에 표시되는 팀별 현재 상황을 발행합니다. '공개'를 켠 상태만 시청자에게 보이며, 끄면 '확인된 정보 없음'으로 표시됩니다."
        actions={
          <Link href="/control-room" target="_blank" className="btn btn-sm">
            공개 지통실 보기 ↗
          </Link>
        }
      />
      <TeamStatusManager teams={data} incidents={incidentRows} />
    </>
  );
}
