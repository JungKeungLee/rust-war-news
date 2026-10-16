import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { listEventsWithTeams } from "@/server/public";
import { Badge, CoverPlaceholder, EmptyState, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "팀·선수" };

export default async function TeamsPage() {
  const groups = await listEventsWithTeams(await getDb());
  return (
    <>
      <PageHeader kicker="TEAMS" title="팀 및 선수" desc="대결(시즌)별 참가 팀과 소속 선수 정보입니다." />
      {groups.length === 0 ? (
        <EmptyState title="등록된 팀이 없습니다" />
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map(({ event, teams }) => (
            <section key={event.id}>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-2">
                <h2 className="text-xl font-extrabold">{event.name}</h2>
                {event.season && <Badge>{event.season}</Badge>}
                {event.isActive && <Badge tone="red">진행 중</Badge>}
                {event.startsAt && <span className="font-mono text-xs text-dim">{fmtDate(event.startsAt)} ~ {event.endsAt ? fmtDate(event.endsAt) : ""}</span>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {teams.map((t) => (
                  <Link key={t.id} href={`/teams/${t.id}`} className="panel group overflow-hidden hover:border-[#3a4a68]">
                    <div className="h-1.5" style={{ background: t.color }} />
                    <div className="flex items-center gap-3 p-4">
                      {t.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logoUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded object-cover" />
                      ) : (
                        <CoverPlaceholder label={(t.shortName ?? t.name).slice(0, 3)} color={t.color} className="h-14 w-14 rounded" />
                      )}
                      <div className="min-w-0">
                        <div className={`truncate text-lg font-extrabold group-hover:underline ${t.isEliminated ? "text-dim line-through" : ""}`}>{t.name}</div>
                        <div className="text-xs text-muted">
                          선수 {t.memberCount}명 · 점수 <span className="font-mono">{t.score}</span>
                        </div>
                      </div>
                    </div>
                    {t.description && <p className="line-clamp-2 px-4 pb-4 text-sm text-muted">{t.description}</p>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
