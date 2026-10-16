"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PollStatus } from "@/lib/live/client";
import { useLiveState } from "@/lib/live/client";
import { fmtTime } from "@/lib/format";
import { TEAM_STATUS_LABEL, type TeamStatus } from "@/lib/labels";
import { cx, VerificationBadge } from "@/components/ui";
import { BroadcastPlayer, BroadcastStatusBar } from "./BroadcastPlayer";

/**
 * 갱신 상태 표시. "실시간 게임 데이터 수집"이 아니라 방송국이 공개 승인한 정보의
 * 최신 반영 여부임을 문구로 분명히 한다.
 */
export function SyncIndicator({ status, lastOk, serverTime, intervalSec }: { status: PollStatus; lastOk: number | null; serverTime?: string | null; intervalSec: number }) {
  const label =
    status === "error"
      ? "네트워크 연결 오류 · 재시도 중"
      : status === "checking"
        ? "업데이트 확인 중"
        : status === "paused"
          ? "탭이 숨겨져 갱신 일시 중지"
          : "최신 공개 정보 반영 완료";
  const dot = status === "error" ? "bg-alert" : status === "checking" ? "bg-warn" : status === "paused" ? "bg-dim" : "bg-ok";
  const last = lastOk ? new Date(lastOk) : serverTime ? new Date(serverTime) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted" aria-live="polite">
      <span className="inline-flex items-center gap-1.5">
        <span className={cx("h-2 w-2 rounded-full", dot)} />
        {label}
      </span>
      <span className="font-mono text-dim" suppressHydrationWarning>
        마지막 정상 갱신 {last ? fmtTime(last) : "-"} · {intervalSec}초 주기
      </span>
    </span>
  );
}

const TEAM_STATUS_STYLE: Record<TeamStatus, string> = {
  UNKNOWN: "bg-panel2 text-muted ring-line",
  NORMAL: "bg-ok/10 text-ok ring-ok/40",
  INCIDENT: "bg-warn/10 text-warn ring-warn/50",
  ALERT: "bg-alert/20 text-red-200 ring-alert/70",
};

export function TeamStatusBadge({ status, className }: { status: TeamStatus; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[0.72rem] font-black ring-1", TEAM_STATUS_STYLE[status], className)}>
      {status === "ALERT" && <span className="live-dot h-1.5 w-1.5 rounded-full bg-alert" />}
      {TEAM_STATUS_LABEL[status]}
    </span>
  );
}

/** 상대 시각을 주기적으로 다시 그리는 작은 시계 (클라이언트 전용) */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ms]);
  return now;
}

/** 메인 페이지: 방송 상태 → 16:9 플레이어 → 긴급 속보 티커 (공유 /api/live 폴링 1개 사용) */
export function HomeBroadcast() {
  const { data, status, lastOk } = useLiveState(null);
  const s = data;
  if (!s) return null;
  const urgent = s.breaking;
  return (
    <section className="flex flex-col gap-3" aria-label="RWN 뉴스 방송">
      <BroadcastStatusBar b={s.broadcast} />
      <BroadcastPlayer b={s.broadcast} />
      <div className="flex items-stretch overflow-hidden rounded-md border border-alert/40 bg-[#0a0f1b]" aria-live="polite">
        <Link href="/breaking" className="flex shrink-0 items-center bg-alert px-3 font-mono text-xs font-black tracking-widest text-white">
          속보
        </Link>
        <div className="relative min-w-0 flex-1 overflow-hidden py-2.5">
          {urgent.length === 0 ? (
            <div className="px-3 text-sm text-muted">현재 송출 중인 속보가 없습니다.</div>
          ) : (
            <div className="ticker-track px-3 text-sm">
              {[...urgent, ...urgent].map((b, i) => (
                <Link key={`${b.id}-${i}`} href="/breaking" className="inline-flex items-center gap-2 hover:underline">
                  {b.priority === "URGENT" && <span className="rounded bg-alert px-1 text-[0.7rem] font-black text-white">긴급</span>}
                  <VerificationBadge status={b.verificationStatus} />
                  <span className="font-semibold">{b.title}</span>
                  <span className="font-mono text-xs text-dim">{fmtTime(b.startsAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <SyncIndicator status={status} lastOk={lastOk} serverTime={s.serverTime} intervalSec={5} />
    </section>
  );
}
