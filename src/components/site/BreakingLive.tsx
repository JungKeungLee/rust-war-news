"use client";

import { useLiveState } from "@/lib/live/client";
import type { PublicLiveState } from "@/lib/live/types";
import { fmtRelative, fmtTime } from "@/lib/format";
import { VerificationBadge } from "@/components/ui";

export function BreakingLive({ initial }: { initial: PublicLiveState }) {
  const { data, lastOk, error } = useLiveState(initial);
  const items = (data ?? initial).breaking;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <span className="live-dot h-2.5 w-2.5 rounded-full bg-alert" /> 송출 중인 속보
        </h2>
        <span className="font-mono text-xs text-dim" suppressHydrationWarning>
          {error ? "연결 재시도 중…" : lastOk ? `자동 갱신 · ${fmtTime(new Date(lastOk))}` : "자동 갱신"}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="panel px-4 py-8 text-center text-muted">현재 송출 중인 속보가 없습니다.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((b) => (
            <li key={b.id} className={`panel p-4 ${b.priority === "URGENT" ? "border-alert/70 bg-alert/5" : ""}`}>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {b.priority === "URGENT" ? (
                  <span className="rounded bg-alert px-1.5 py-0.5 text-xs font-black text-white">긴급 속보</span>
                ) : (
                  <span className="rounded bg-panel2 px-1.5 py-0.5 text-xs font-black ring-1 ring-line">속보</span>
                )}
                {b.isPinned && <span className="text-xs text-muted">📌 고정</span>}
                <VerificationBadge status={b.verificationStatus} />
                <span className="font-mono text-xs text-dim" suppressHydrationWarning>
                  {fmtRelative(b.startsAt)}
                </span>
              </div>
              <div className="text-lg font-extrabold leading-snug">{b.title}</div>
              {b.body && <p className="mt-1 whitespace-pre-line text-muted">{b.body}</p>}
              {b.correctedAt && (
                <p className="mt-2 rounded bg-intel/10 px-2 py-1 text-sm text-blue-300">
                  [정정 {fmtTime(b.correctedAt)}] {b.correctionNote ?? "내용이 정정되었습니다."}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
