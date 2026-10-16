import type { Metadata } from "next";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { players, teamMembers, teams } from "@/db/schema";
import { getActiveEvent } from "@/server/public";
import { getSettings } from "@/server/settings";
import { ClipForm } from "@/components/site/ClipForm";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "클립 제보" };

export default async function NewClipPage() {
  const db = await getDb();
  const [settings, ev] = await Promise.all([getSettings(db), getActiveEvent(db)]);
  const teamList = ev
    ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(and(eq(teams.eventId, ev.id), eq(teams.isPublic, true))).orderBy(asc(teams.name))
    : [];
  const playerList = ev
    ? await db
        .selectDistinct({ id: players.id, nickname: players.nickname })
        .from(players)
        .innerJoin(teamMembers, eq(teamMembers.playerId, players.id))
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(and(eq(teams.eventId, ev.id), isNull(teamMembers.leftAt)))
        .orderBy(asc(players.nickname))
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader kicker="SUBMIT CLIP" title="클립 제보" desc="YouTube, SOOP, 치지직, Twitch 등의 영상 링크를 보내주세요. 운영진 승인 후 공개됩니다." />
      {settings.intake.clipsOpen ? <ClipForm teams={teamList} players={playerList} /> : <EmptyState title="지금은 클립 접수를 잠시 중단했습니다" />}
    </div>
  );
}
