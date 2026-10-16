import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { episodes } from "@/db/schema";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { StatusPill } from "@/components/admin/forms";
import { EpisodeCreateForm } from "@/components/admin/EpisodeForms";
import { fmtDateTime } from "@/lib/format";
import { EPISODE_STATUS_LABEL } from "@/lib/labels";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata = { title: "뉴스 회차" };

export default async function AdminEpisodesPage() {
  const session = await requirePagePermission("rundown.operate");
  if (!session) return <Forbidden />;
  const db = await getDb();
  const [rows, lookups] = await Promise.all([db.select().from(episodes).orderBy(desc(episodes.createdAt)).limit(100), getLookups(db)]);
  const canManage = hasPermission(session.roles, "episodes.manage");

  return (
    <>
      <AdminTitle title="뉴스 회차 · 큐시트" desc="회차별 정규 뉴스를 기획하고 큐시트·진행자별 대본을 관리합니다." />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="panel divide-y divide-line">
          {rows.length === 0 && <p className="p-6 text-center text-muted">방송 회차가 없습니다.</p>}
          {rows.map((e) => (
            <Link key={e.id} href={`/admin/episodes/${e.id}`} className="flex flex-col gap-1 p-3 hover:bg-panel2 sm:flex-row sm:items-center sm:gap-3">
              <StatusPill tone={e.status === "LIVE" ? "red" : e.status === "READY" ? "blue" : e.status === "ENDED" ? "default" : "amber"}>{EPISODE_STATUS_LABEL[e.status]}</StatusPill>
              <span className="font-mono text-xs text-dim">{e.number != null ? `제${e.number}회` : ""}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{e.title}</span>
              {e.status === "ENDED" && <StatusPill tone={e.isPublic ? "green" : "default"}>{e.isPublic ? "아카이브 공개" : "아카이브 비공개"}</StatusPill>}
              <span className="font-mono text-xs text-dim">{fmtDateTime(e.scheduledAt)}</span>
            </Link>
          ))}
        </div>
        {canManage && <EpisodeCreateForm anchors={lookups.anchors} events={lookups.events} />}
      </div>
    </>
  );
}
