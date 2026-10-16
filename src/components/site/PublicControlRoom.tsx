"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/live/client";
import type { ControlRoomOverview } from "@/server/control-room";
import { fmtTime } from "@/lib/format";
import { CLIP_PLATFORM_LABEL } from "@/lib/labels";
import { EmptyState, SectionTitle, VerificationBadge, cx } from "@/components/ui";
import { IncidentTimeline, TeamCard } from "./control-room-ui";
import { SyncIndicator, useNow } from "./live-ui";

const POLL_MS = 15_000;
type Filter = "all" | "recent" | "alert" | "updated";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체 팀" },
  { key: "recent", label: "최근 24시간 사건" },
  { key: "alert", label: "긴급 상태" },
  { key: "updated", label: "최근 공개 업데이트" },
];

export function PublicControlRoom({ initial }: { initial: ControlRoomOverview }) {
  const { data, status, lastOk } = usePolling<ControlRoomOverview>("/api/control-room", { initial, intervalMs: POLL_MS });
  const d = data ?? initial;
  const now = useNow();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const teams = useMemo(() => {
    const dayAgo = (now ?? new Date(d.serverTime).getTime()) - 24 * 3600 * 1000;
    return d.teams
      .filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()) || (t.shortName ?? "").toLowerCase().includes(q.trim().toLowerCase()))
      .filter((t) => {
        if (filter === "recent") return t.recentIncidentCount > 0;
        if (filter === "alert") return t.status === "ALERT";
        if (filter === "updated") return !!t.statusUpdatedAt && new Date(t.statusUpdatedAt).getTime() > dayAgo;
        return true;
      });
  }, [d, q, filter, now]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 border-b border-line pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="panel-head mb-1 text-alert">RWN CONTROL ROOM</div>
            <h1 className="text-2xl font-black sm:text-3xl">RWN 종합 지통실</h1>
            <p className="mt-1 text-sm text-muted">
              {d.event ? `${d.event.name} · ` : ""}RWN 방송국이 확인·공개 승인한 정보만 표시합니다. 게임 데이터를 직접 수집하지 않습니다.
            </p>
          </div>
          <SyncIndicator status={status} lastOk={lastOk} serverTime={d.serverTime} intervalSec={POLL_MS / 1000} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="참가 팀" value={d.stats.teamCount} />
          <Stat label="참가 선수" value={d.stats.playerCount} />
          <Stat label="진행 중 공개 사건" value={d.stats.openIncidentCount} />
          <Stat label="긴급 속보" value={d.stats.urgentBreakingCount} tone={d.stats.urgentBreakingCount ? "text-alert" : undefined} />
          <div className="panel col-span-2 p-3 sm:col-span-1">
            <div className="panel-head">공개 정보 최신 갱신</div>
            <div className="mt-1 font-mono text-lg font-black" suppressHydrationWarning>
              {d.lastPublicUpdate ? fmtTime(d.lastPublicUpdate) : "-"}
            </div>
          </div>
        </div>
      </header>

      {d.breaking.length > 0 && (
        <section className="panel border-alert/50 p-3" aria-live="polite">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold">
              <span className="live-dot h-2 w-2 rounded-full bg-alert" /> 송출 중인 속보
            </span>
            <Link href="/breaking" className="text-xs text-muted hover:text-ink">
              전체 속보 →
            </Link>
          </div>
          <ul className="flex flex-col gap-1.5">
            {d.breaking.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                {b.priority === "URGENT" && <span className="rounded bg-alert px-1.5 text-[0.7rem] font-black text-white">긴급</span>}
                <VerificationBadge status={b.verificationStatus} />
                <span className="font-semibold">{b.title}</span>
                <span className="font-mono text-xs text-dim">{fmtTime(b.startsAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-extrabold">팀별 상황</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input className="field sm:w-56" placeholder="팀 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="팀 이름 검색" />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={cx("btn btn-sm", filter === f.key && "border-alert bg-alert/15")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {d.teams.length === 0 ? (
          <EmptyState title="공개된 참가 팀이 없습니다" />
        ) : teams.length === 0 ? (
          <EmptyState title="조건에 맞는 팀이 없습니다" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teams.map((t) => (
              <TeamCard key={t.id} t={t} now={now} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle kicker="Timeline">최신 공개 사건</SectionTitle>
          <IncidentTimeline items={d.timeline} />
        </section>
        <div className="flex flex-col gap-8">
          <section>
            <SectionTitle kicker="News" href="/news">
              최근 뉴스
            </SectionTitle>
            {d.articles.length ? (
              <ul className="panel divide-y divide-line/60">
                {d.articles.map((a) => (
                  <li key={a.id}>
                    <Link href={`/news/${a.id}`} className="flex flex-col gap-1 p-3 hover:bg-panel2">
                      <div className="flex items-center gap-1.5">
                        <VerificationBadge status={a.verificationStatus} />
                        <span className="font-mono text-xs text-dim">{fmtTime(a.publishedAt)}</span>
                      </div>
                      <span className="font-semibold">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel p-4 text-sm text-muted">발행된 뉴스가 없습니다.</p>
            )}
          </section>
          <section>
            <SectionTitle kicker="Hot Clips" href="/clips">
              핫 클립
            </SectionTitle>
            {d.clips.length ? (
              <ul className="panel divide-y divide-line/60">
                {d.clips.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="min-w-0 truncate">
                      {c.isHot && <span className="mr-1 font-black text-alert">HOT</span>}
                      {c.title}
                    </span>
                    <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-sm shrink-0">
                      {CLIP_PLATFORM_LABEL[c.platform]} ↗
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel p-4 text-sm text-muted">선정된 핫 클립이 없습니다.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="panel p-3">
      <div className="panel-head">{label}</div>
      <div className={cx("mt-1 font-mono text-2xl font-black", tone)}>{value}</div>
    </div>
  );
}
