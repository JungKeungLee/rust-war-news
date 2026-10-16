"use client";

import Link from "next/link";
import { useLiveState } from "@/lib/live/client";
import type { PublicLiveState } from "@/lib/live/types";
import { fmtTime } from "@/lib/format";

/** 상단 실시간 속보 티커 + LIVE 표시. 4초 폴링으로 갱신된다. */
export function LiveBar({ initial }: { initial: PublicLiveState }) {
  const { data, error } = useLiveState(initial);
  const state = data ?? initial;
  const items = state.breaking;

  return (
    <div className="border-b border-line bg-[#0a0f1b]" aria-live="polite">
      {state.live.isLive && state.live.url && (
        <a
          href={state.live.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-alert px-3 py-1.5 text-sm font-bold text-white hover:bg-[#c81824]"
        >
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-white" />
          LIVE · {state.live.title ?? "RWN 뉴스 방송 중"} — 방송 보러가기 ↗
        </a>
      )}
      <div className="mx-auto flex max-w-7xl items-stretch">
        <Link href="/breaking" className="flex shrink-0 items-center bg-alert-deep px-3 font-mono text-xs font-black tracking-widest text-white">
          속보
        </Link>
        <div className="relative min-w-0 flex-1 overflow-hidden py-2">
          {items.length === 0 ? (
            <div className="px-3 text-sm text-muted">현재 송출 중인 속보가 없습니다.</div>
          ) : (
            <div className="ticker-track px-3 text-sm">
              {[...items, ...items].map((b, i) => (
                <Link key={`${b.id}-${i}`} href="/breaking" className="inline-flex items-center gap-2 hover:underline">
                  {b.priority === "URGENT" && <span className="rounded bg-alert px-1 text-[0.7rem] font-black text-white">긴급</span>}
                  {b.verificationStatus !== "CONFIRMED" && <span className="text-[0.7rem] font-bold text-warn">[미확인]</span>}
                  {b.correctedAt && <span className="text-[0.7rem] font-bold text-blue-300">[정정]</span>}
                  <span className="font-semibold">{b.title}</span>
                  <span className="font-mono text-xs text-dim">{fmtTime(b.startsAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        {error && (
          <span className="flex items-center px-2 text-[0.7rem] text-warn" title={error}>
            재연결 중
          </span>
        )}
      </div>
    </div>
  );
}
