"use client";

import Link from "next/link";
import { usePolling } from "@/lib/live/client";
import type { TeamControlRoom } from "@/server/control-room";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { CLIP_PLATFORM_LABEL, TEAM_STATUS_LABEL } from "@/lib/labels";
import { Badge, CoverPlaceholder, EmptyState, SectionTitle, TeamChip, VerificationBadge, cx } from "@/components/ui";
import { IncidentTimeline } from "./control-room-ui";
import { SyncIndicator, TeamStatusBadge, useNow } from "./live-ui";

const POLL_MS = 10_000;

export function TeamControlRoomView({ initial }: { initial: TeamControlRoom }) {
  const { data, status, lastOk, error } = usePolling<TeamControlRoom>(`/api/control-room/${initial.team.id}`, { initial, intervalMs: POLL_MS });
  const d = data ?? initial;
  const now = useNow();
  const t = d.team;
  const hostile = d.relatedTeams.filter((r) => r.hostile > 0);
  const allies = d.relatedTeams.filter((r) => r.alliedConfirmed > 0);
  const others = d.relatedTeams.filter((r) => r.hostile === 0 && r.alliedConfirmed === 0);

  // 보는 중에 팀이 비공개로 바뀌면 받아 둔 정보도 더 이상 보여주지 않는다
  if (error?.includes("404")) {
    return (
      <div className="panel mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-black">이 팀 지통실은 현재 공개되지 않습니다</h1>
        <Link href="/control-room" className="btn mt-4">
          종합 지통실로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/control-room" className="text-sm text-muted hover:text-ink">
          ← 종합 지통실
        </Link>
        <SyncIndicator status={status} lastOk={lastOk} serverTime={d.serverTime} intervalSec={POLL_MS / 1000} />
      </div>

      {/* A. 팀 기본 정보 + C. 현재 상황 */}
      <section className={cx("panel overflow-hidden", d.status.status === "ALERT" && "border-alert/70")}>
        <div className="h-2" style={{ background: t.color }} />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex gap-4">
            {t.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logoUrl} alt="" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded object-cover sm:h-24 sm:w-24" />
            ) : (
              <CoverPlaceholder label={(t.shortName ?? t.name).slice(0, 3)} color={t.color} className="h-20 w-20 shrink-0 rounded sm:h-24 sm:w-24" />
            )}
            <div className="min-w-0">
              <div className="panel-head">{t.event ? `${t.event.name}${t.event.season ? ` · ${t.event.season}` : ""}` : "대결 미지정"}</div>
              <h1 className={cx("text-2xl font-black sm:text-3xl", t.isEliminated && "text-dim line-through")}>{t.name}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge>선수 {t.memberCount}명</Badge>
                <Badge>점수 {t.score}</Badge>
                {t.isEliminated && <Badge tone="red">탈락</Badge>}
              </div>
              {t.description && <p className="mt-2 whitespace-pre-line text-sm text-muted">{t.description}</p>}
            </div>
          </div>
          <div className="rounded border border-line bg-panel2/60 p-3">
            <div className="panel-head mb-1">현재 팀 상황 (방송국 발표)</div>
            <div className="flex flex-wrap items-center gap-2">
              <TeamStatusBadge status={d.status.status} className="text-sm" />
              {d.status.status === "UNKNOWN" && <span className="text-xs text-dim">방송국이 공개한 상태 정보가 없습니다</span>}
            </div>
            {d.status.message && <p className="mt-2 whitespace-pre-line text-sm">{d.status.message}</p>}
            {d.status.incident && (
              <Link href="#incidents" className="mt-1 inline-block text-xs text-blue-300 hover:underline">
                관련 사건: {d.status.incident.title}
              </Link>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded bg-panel p-2">
                <dt className="text-dim">24시간 사건</dt>
                <dd className="font-mono text-lg font-black">{d.status.recentIncidentCount}</dd>
              </div>
              <div className="rounded bg-panel p-2">
                <dt className="text-dim">관련 속보</dt>
                <dd className="font-mono text-lg font-black">{d.status.breakingCount}</dd>
              </div>
              <div className="rounded bg-panel p-2">
                <dt className="text-dim">공개 사건</dt>
                <dd className="font-mono text-lg font-black">{d.status.incidentCount}</dd>
              </div>
            </dl>
            <p className="mt-2 font-mono text-[0.7rem] text-dim" suppressHydrationWarning>
              상태 갱신 {d.status.updatedAt ? fmtDateTime(d.status.updatedAt) : "-"} · 공개 정보 갱신 {d.lastPublicUpdate ? (now ? fmtRelative(d.lastPublicUpdate, now) : fmtDateTime(d.lastPublicUpdate)) : "-"}
            </p>
            <p className="mt-1 text-[0.7rem] text-dim">상태는 방송국이 확인해 발표한 내용이며, 각 사건의 사실 확인 여부는 사건별 배지로 따로 표시합니다.</p>
          </div>
        </div>
      </section>

      {/* D. 팀 관련 속보 */}
      <section>
        <SectionTitle kicker="Breaking">팀 관련 속보</SectionTitle>
        {d.breaking.length === 0 ? (
          <p className="panel p-4 text-sm text-muted">이 팀과 연결된 공개 속보가 없습니다.</p>
        ) : (
          <ul className="panel divide-y divide-line/60">
            {d.breaking.map((b) => (
              <li key={b.id} className={cx("flex flex-col gap-1 p-3", b.active && "bg-alert/5")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {b.active ? <Badge tone="red">● 송출 중</Badge> : <Badge>지난 속보</Badge>}
                  {b.priority === "URGENT" ? <Badge tone="red">긴급</Badge> : <Badge>일반</Badge>}
                  <VerificationBadge status={b.verificationStatus} />
                  {b.corrected && <Badge tone="blue">정정</Badge>}
                  <span className="font-mono text-xs text-dim">{fmtDateTime(b.at)}</span>
                </div>
                <div className="font-semibold">{b.title}</div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {b.incident?.title && <span className="text-muted">사건: {b.incident.title}</span>}
                  {b.articleId && (
                    <Link href={`/news/${b.articleId}`} className="text-blue-300 hover:underline">
                      상세 뉴스 →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* E. 사건 타임라인 */}
        <section id="incidents">
          <SectionTitle kicker="Timeline">사건 타임라인</SectionTitle>
          <IncidentTimeline items={d.incidents} empty="이 팀과 연결된 공개 사건이 없습니다." />
        </section>

        <div className="flex flex-col gap-8">
          {/* B. 선수 명단 */}
          <section>
            <SectionTitle kicker="Roster">선수 명단 ({d.players.length})</SectionTitle>
            {d.players.length === 0 ? (
              <p className="panel p-4 text-sm text-muted">등록된 선수가 없습니다.</p>
            ) : (
              <ul className="panel divide-y divide-line/60">
                {d.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-3">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel2 font-bold" style={{ boxShadow: `inset 0 0 0 2px ${t.color}` }}>
                        {p.nickname.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">
                        {p.nickname} {p.role && <span className="text-xs font-normal text-muted">· {p.role}</span>}
                      </div>
                      <div className="text-xs text-dim">
                        {p.platform ? `${p.platform} · ` : ""}방송 상태: 확인 안 됨
                      </div>
                    </div>
                    {p.streamUrl && (
                      <a href={p.streamUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-sm shrink-0">
                        방송국 ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[0.7rem] text-dim">선수 개인 방송의 실제 방송 여부는 외부 플랫폼과 연동하지 않아 표시하지 않습니다.</p>
          </section>

          {/* H. 관련 팀 */}
          <section>
            <SectionTitle kicker="Relations">관련 팀</SectionTitle>
            {d.relatedTeams.length === 0 ? (
              <p className="panel p-4 text-sm text-muted">공개된 사건으로 연결된 팀이 없습니다.</p>
            ) : (
              <div className="panel flex flex-col gap-3 p-3 text-sm">
                <RelatedGroup title="공개된 교전 상대" items={hostile} note={(r) => `교전 관련 사건 ${r.hostile}건`} />
                <RelatedGroup title="확인된 동맹" items={allies} note={(r) => `확인 완료 동맹 ${r.alliedConfirmed}건`} />
                <RelatedGroup title="기타 관련 사건" items={others} note={(r) => `관련 사건 ${r.incidentIds.length}건`} />
              </div>
            )}
          </section>
        </div>
      </div>

      {/* F. 팀 관련 뉴스 */}
      <section>
        <SectionTitle kicker="News">팀 관련 뉴스</SectionTitle>
        {d.news.length === 0 ? (
          <EmptyState title="이 팀과 연결된 발행 기사가 없습니다" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.news.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="panel group flex flex-col overflow-hidden hover:border-[#3a4a68]">
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" referrerPolicy="no-referrer" className="aspect-[16/7] w-full object-cover" />
                ) : (
                  <CoverPlaceholder label="RWN NEWS" className="aspect-[16/7]" />
                )}
                <div className="flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-1.5">
                    <VerificationBadge status={a.verificationStatus} />
                    <span className="font-mono text-xs text-dim">{fmtDateTime(a.publishedAt)}</span>
                  </div>
                  <span className="font-bold group-hover:underline">{a.title}</span>
                  {a.lead && <span className="line-clamp-2 text-xs text-muted">{a.lead}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* G. 팀 관련 핫 클립 */}
      <section>
        <SectionTitle kicker="Clips">팀 관련 클립</SectionTitle>
        {d.clips.length === 0 ? (
          <p className="panel p-4 text-sm text-muted">이 팀과 연결된 공개 클립이 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.clips.map((c) => (
              <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="panel group flex flex-col overflow-hidden hover:border-[#3a4a68]">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnailUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-video w-full object-cover" />
                ) : (
                  <CoverPlaceholder label={CLIP_PLATFORM_LABEL[c.platform]} color={t.color} className="aspect-video" />
                )}
                <div className="flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-1.5">
                    {c.isHot && <Badge tone="red">HOT</Badge>}
                    <Badge>{CLIP_PLATFORM_LABEL[c.platform]}</Badge>
                  </div>
                  <span className="line-clamp-2 font-bold group-hover:underline">{c.title}</span>
                  <span className="text-xs text-dim">{c.playerName ? `${c.playerName} · ` : ""}원본 영상 ↗</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
      <p className="text-center text-xs text-dim">상태 표시: {Object.values(TEAM_STATUS_LABEL).join(" · ")} — 방송국이 확인·공개한 정보 기준</p>
    </div>
  );
}

function RelatedGroup({
  title,
  items,
  note,
}: {
  title: string;
  items: TeamControlRoom["relatedTeams"];
  note: (r: TeamControlRoom["relatedTeams"][number]) => string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="panel-head mb-1">{title}</div>
      <ul className="flex flex-col gap-1">
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <Link href={`/control-room/${r.id}`} className="hover:underline">
              <TeamChip name={r.name} color={r.color} />
            </Link>
            <span className="text-xs text-dim">
              {note(r)} · 최근 {fmtDateTime(r.lastAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
