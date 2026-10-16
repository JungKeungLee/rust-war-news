import type { Metadata } from "next";
import { getDb } from "@/db";
import { getActiveEvent } from "@/server/public";
import { getSettings } from "@/server/settings";
import { teams } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { ReportForm } from "@/components/site/ReportForm";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "제보하기" };

export default async function NewReportPage() {
  const db = await getDb();
  const [settings, ev] = await Promise.all([getSettings(db), getActiveEvent(db)]);
  const teamList = ev
    ? await db
        .select({ id: teams.id, name: teams.name, color: teams.color })
        .from(teams)
        .where(and(eq(teams.eventId, ev.id), eq(teams.isPublic, true)))
        .orderBy(asc(teams.name))
    : [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader kicker="SUBMIT REPORT" title="제보하기" desc="제보는 운영진 검토 후 승인된 경우에만 공개됩니다. 익명으로 제보하면 공개 화면에 닉네임이 표시되지 않습니다." />
      {settings.intake.reportsOpen ? (
        <ReportForm teams={teamList} />
      ) : (
        <EmptyState title="지금은 제보 접수를 잠시 중단했습니다" desc="운영진이 접수를 다시 열면 제보할 수 있습니다." />
      )}
    </div>
  );
}
