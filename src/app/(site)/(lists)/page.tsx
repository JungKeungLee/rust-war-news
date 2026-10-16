import Link from "next/link";
import { getDb } from "@/db";
import { getActiveBreaking } from "@/server/live";
import { getWarRoom, listArticles, listPublicClips } from "@/server/public";
import { ArticleCard, ClipCard } from "@/components/site/cards";
import { EmptyState, SectionTitle, TeamChip, TypeBadge, VerificationBadge } from "@/components/ui";
import { fmtDateTime, fmtTime } from "@/lib/format";

export default async function HomePage() {
  const db = await getDb();
  const [featured, latest, breaking, clips, war] = await Promise.all([
    listArticles(db, { featured: true, limit: 1 }),
    listArticles(db, { limit: 9 }),
    getActiveBreaking(db),
    listPublicClips(db, { hotOnly: true, limit: 4 }),
    getWarRoom(db),
  ]);
  const hero = featured[0] ?? latest[0];
  const rest = latest.filter((a) => a.id !== hero?.id).slice(0, 6);

  return (
    <div className="flex flex-col gap-10">
      {/* 1. 주요 뉴스 + 실시간 속보 */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle kicker="Top Story">주요 뉴스</SectionTitle>
          {hero ? (
            <ArticleCard a={hero} variant="hero" />
          ) : (
            <EmptyState title="아직 발행된 뉴스가 없습니다" desc="첫 소식은 여러분의 제보에서 시작됩니다." action={<Link href="/reports/new" className="btn btn-red mt-2">제보하기</Link>} />
          )}
        </div>
        <aside className="panel flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="live-dot h-2.5 w-2.5 rounded-full bg-alert" />
              <h2 className="text-lg font-extrabold">실시간 속보</h2>
            </div>
            <Link href="/breaking" className="text-sm text-muted hover:text-ink">
              전체 →
            </Link>
          </div>
          {breaking.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">현재 송출 중인 속보가 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {breaking.slice(0, 6).map((b) => (
                <li key={b.id} className="py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {b.priority === "URGENT" && <span className="rounded bg-alert px-1.5 py-0.5 text-[0.7rem] font-black text-white">긴급</span>}
                    <VerificationBadge status={b.verificationStatus} />
                    <span className="font-mono text-xs text-dim">{fmtTime(b.startsAt)}</span>
                  </div>
                  <div className="font-bold leading-snug">{b.title}</div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/reports/new" className="btn btn-red mt-auto w-full">
            📡 현장 제보하기
          </Link>
        </aside>
      </section>

      {/* 2. 최신 기사 */}
      <section>
        <SectionTitle kicker="Latest" href="/news">
          최신 기사
        </SectionTitle>
        {rest.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="최신 기사가 없습니다" />
        )}
      </section>

      {/* 3. 전쟁 현황 */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle kicker="Situation" href="/war-room" more="상황판">
            전쟁 현황
          </SectionTitle>
          {war.incidents.length ? (
            <ul className="panel divide-y divide-line">
              {war.incidents.slice(0, 6).map((i) => (
                <li key={i.id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-24 shrink-0 font-mono text-xs text-dim">{fmtDateTime(i.occurredAt ?? i.createdAt)}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={i.type} />
                    <VerificationBadge status={i.verificationStatus} />
                  </div>
                  <span className="min-w-0 flex-1 font-semibold">{i.title}</span>
                  <div className="flex flex-wrap gap-1">
                    {i.teams.map((t) => (
                      <TeamChip key={t.teamId} name={t.name} color={t.color} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="공개된 사건이 없습니다" />
          )}
        </div>
        <div>
          <SectionTitle kicker="Teams" href="/teams" more="팀 정보">
            {war.event?.name ?? "참가 팀"}
          </SectionTitle>
          {war.teams.length ? (
            <ol className="panel divide-y divide-line">
              {war.teams.map((t, idx) => (
                <li key={t.id}>
                  <Link href={`/teams/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-panel2">
                    <span className="w-5 font-mono text-sm text-dim">{idx + 1}</span>
                    <span className="h-8 w-1.5 rounded" style={{ background: t.color }} />
                    <span className={`flex-1 font-bold ${t.isEliminated ? "text-dim line-through" : ""}`}>{t.name}</span>
                    {t.statusLabel && <span className="text-xs text-muted">{t.statusLabel}</span>}
                    <span className="font-mono font-bold">{t.score}</span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="등록된 팀이 없습니다" />
          )}
        </div>
      </section>

      {/* 4. 핫 클립 */}
      <section>
        <SectionTitle kicker="Hot Clips" href="/clips">
          핫 클립
        </SectionTitle>
        {clips.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {clips.map((c) => (
              <ClipCard key={c.clip.id} clip={c.clip} teamName={c.teamName} teamColor={c.teamColor} playerName={c.playerName} />
            ))}
          </div>
        ) : (
          <EmptyState title="선정된 핫 클립이 없습니다" action={<Link href="/clips/new" className="btn mt-2">클립 제보하기</Link>} />
        )}
      </section>

      {/* 5. 제보 CTA */}
      <section className="panel ops-grid flex flex-col items-start gap-3 border-alert/40 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="panel-head text-alert">Field Report</div>
          <h2 className="text-xl font-black">전장의 소식을 RWN에 제보하세요</h2>
          <p className="mt-1 text-sm text-muted">전투, 레이드, 동맹, 배신 — 제보는 운영진 검토 후에만 공개되며 익명 제보도 가능합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports/new" className="btn btn-red">
            제보하기
          </Link>
          <Link href="/clips/new" className="btn">
            클립 제보
          </Link>
        </div>
      </section>
    </div>
  );
}
