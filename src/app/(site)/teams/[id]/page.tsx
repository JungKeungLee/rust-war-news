import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getPublicTeam } from "@/server/public";
import { ArticleCard } from "@/components/site/cards";
import { Badge, CoverPlaceholder, EmptyState, TypeBadge, VerificationBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getPublicTeam(await getDb(), id);
  if (!data) notFound();
  const { team, event, members, incidents, news } = data;
  const current = members.filter((m) => !m.member.leftAt);
  const former = members.filter((m) => m.member.leftAt);

  return (
    <div className="flex flex-col gap-8">
      <div className="panel overflow-hidden">
        <div className="h-2" style={{ background: team.color }} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" referrerPolicy="no-referrer" className="h-24 w-24 rounded object-cover" />
          ) : (
            <CoverPlaceholder label={(team.shortName ?? team.name).slice(0, 3)} color={team.color} className="h-24 w-24 rounded" />
          )}
          <div className="flex-1">
            <Link href="/teams" className="text-sm text-muted hover:text-ink">
              ← 팀 목록 {event ? `· ${event.name}` : ""}
            </Link>
            <h1 className="mt-1 text-3xl font-black">{team.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {team.statusLabel && <Badge tone="blue">{team.statusLabel}</Badge>}
              {team.isEliminated && <Badge tone="red">탈락</Badge>}
              <Badge>점수 {team.score}</Badge>
            </div>
            {team.description && <p className="mt-3 whitespace-pre-line text-muted">{team.description}</p>}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">소속 선수 ({current.length})</h2>
        {current.length === 0 ? (
          <EmptyState title="등록된 선수가 없습니다" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map(({ member, player }) => (
              <div key={member.id} className="panel flex items-center gap-3 p-3">
                {player.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-panel2 font-bold" style={{ boxShadow: `inset 0 0 0 2px ${team.color}` }}>
                    {player.nickname.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {player.nickname} {member.role && <span className="text-xs font-normal text-muted">· {member.role}</span>}
                  </div>
                  {player.profile && <p className="line-clamp-1 text-xs text-muted">{player.profile}</p>}
                </div>
                {player.streamUrl && (
                  <a href={player.streamUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-sm">
                    방송 ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {former.length > 0 && <p className="mt-3 text-sm text-dim">이전 소속: {former.map((m) => m.player.nickname).join(", ")}</p>}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-extrabold">관련 사건</h2>
          {incidents.length === 0 ? (
            <EmptyState title="공개된 사건이 없습니다" />
          ) : (
            <ul className="panel divide-y divide-line">
              {incidents.map((i) => (
                <li key={i.id} className="p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={i.type} />
                    <VerificationBadge status={i.verificationStatus} />
                    <span className="font-mono text-xs text-dim">{fmtDateTime(i.occurredAt)}</span>
                  </div>
                  <div className="font-semibold">{i.title}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-extrabold">관련 뉴스</h2>
          {news.length === 0 ? (
            <EmptyState title="관련 뉴스가 없습니다" />
          ) : (
            <div className="panel px-4">
              {news.map((a) => (
                <ArticleCard key={a.id} a={a} variant="compact" />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
