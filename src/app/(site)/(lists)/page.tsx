import Link from "next/link";
import { getDb } from "@/db";
import { getControlRoomOverview } from "@/server/control-room";
import { listArticles, listPublicClips } from "@/server/public";
import { ArticleCard, ClipCard } from "@/components/site/cards";
import { HomeBroadcast } from "@/components/site/live-ui";
import { IncidentTimeline, TeamCard } from "@/components/site/control-room-ui";
import { EmptyState, SectionTitle } from "@/components/ui";

/**
 * 메인 페이지 배치
 * 1 상단 내비(레이아웃) → 2 방송 상태 → 3 16:9 방송 플레이어(1개) → 4 긴급 속보 티커
 * → 5 팀별 지통실 미리보기 → 6 최신 뉴스 → 7 핫 클립 → 8 주요 사건 타임라인 → 9 제보 → 10 하단 정보(레이아웃)
 */
export default async function HomePage() {
  const db = await getDb();
  const [overview, latest, clips] = await Promise.all([getControlRoomOverview(db), listArticles(db, { limit: 6 }), listPublicClips(db, { hotOnly: true, limit: 4 })]);
  const teamsPreview = [...overview.teams]
    .sort((a, b) => ["ALERT", "INCIDENT", "NORMAL", "UNKNOWN"].indexOf(a.status) - ["ALERT", "INCIDENT", "NORMAL", "UNKNOWN"].indexOf(b.status) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-10">
      {/* 2~4. 방송 상태 · 플레이어 · 긴급 속보 */}
      <div className="mx-auto w-full max-w-5xl">
        <HomeBroadcast />
      </div>

      {/* 5. 팀별 지통실 미리보기 */}
      <section>
        <SectionTitle kicker="Control Room" href="/control-room" more="종합 지통실">
          팀별 지통실 {overview.event ? <span className="text-base font-bold text-muted">· {overview.event.name}</span> : null}
        </SectionTitle>
        {teamsPreview.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamsPreview.map((t) => (
              <TeamCard key={t.id} t={t} />
            ))}
          </div>
        ) : (
          <EmptyState title="공개된 참가 팀이 없습니다" />
        )}
      </section>

      {/* 6. 최신 뉴스 */}
      <section>
        <SectionTitle kicker="Latest" href="/news">
          최신 뉴스
        </SectionTitle>
        {latest.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="발행된 뉴스가 없습니다" desc="첫 소식은 여러분의 제보에서 시작됩니다." />
        )}
      </section>

      {/* 7. 핫 클립 */}
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

      {/* 8. 최근 주요 사건 */}
      <section>
        <SectionTitle kicker="Timeline" href="/control-room" more="지통실에서 보기">
          최근 주요 사건
        </SectionTitle>
        <IncidentTimeline items={overview.timeline.slice(0, 8)} />
      </section>

      {/* 9. 제보 */}
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
