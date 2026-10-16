"use client";

import { useState } from "react";
import { BROADCAST_PLATFORM_LABEL, type PublicBroadcast } from "@/lib/broadcast";
import { BROADCAST_STATUS_LABEL } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { cx } from "@/components/ui";

const STATUS_STYLE = {
  LIVE: "bg-alert text-white",
  STANDBY: "bg-warn text-black",
  OFFLINE: "bg-panel2 text-muted ring-1 ring-line",
  UNKNOWN: "bg-panel2 text-muted ring-1 ring-line",
} as const;

/** 방송 상태 표시줄. 상태는 방송국 수동 설정임을 함께 표기한다 (자동 감지와 혼동 방지) */
export function BroadcastStatusBar({ b }: { b: PublicBroadcast }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={cx("inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-black", STATUS_STYLE[b.status])}>
        {b.status === "LIVE" && <span className="live-dot h-2 w-2 rounded-full bg-white" />}
        {b.status === "LIVE" ? "LIVE" : BROADCAST_STATUS_LABEL[b.status]}
      </span>
      <h1 className="min-w-0 truncate text-lg font-black sm:text-xl">{b.title ?? "RWN 뉴스 방송"}</h1>
      <span className="text-xs text-dim" title="외부 방송 플랫폼과 자동 연동되지 않은, 방송국이 직접 설정한 상태입니다.">
        방송국 설정 상태{b.updatedAt ? ` · ${fmtDateTime(b.updatedAt)} 갱신` : ""}
      </span>
    </div>
  );
}

/**
 * 메인 방송 플레이어 (단일). 16:9 고정, 화면 폭을 넘지 않는다.
 * - LIVE + 임베드 가능 → iframe (음소거 자동 재생, 전체 화면 허용)
 * - LIVE + 임베드 불가 → 썸네일 + 원본 링크
 * - 그 외 → RWN 대기 화면
 * 외부 플레이어가 오류를 내도 iframe 안에서만 발생하므로 페이지는 그대로 동작한다.
 */
export function BroadcastPlayer({ b }: { b: PublicBroadcast }) {
  const [loaded, setLoaded] = useState(false);
  const live = b.status === "LIVE" && !!b.url;
  const platform = b.platform ? BROADCAST_PLATFORM_LABEL[b.platform] : "방송";

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-md border border-line bg-black" style={{ aspectRatio: "16 / 9" }}>
        {live && b.embedUrl ? (
          <>
            {!loaded && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">플레이어 불러오는 중…</div>}
            <iframe
              key={b.embedUrl}
              src={b.embedUrl}
              title={b.title ?? "RWN 뉴스 방송"}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoaded(true)}
            />
          </>
        ) : live ? (
          <a href={b.url!} target="_blank" rel="noopener noreferrer" className="group absolute inset-0 block">
            {b.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-70 group-hover:opacity-90" />
            ) : (
              <div className="ops-grid h-full w-full bg-panel2" />
            )}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <span className="rounded-full bg-alert px-5 py-2.5 text-base font-black text-white shadow-lg">▶ {platform}에서 시청하기</span>
              <span className="text-xs text-white/80">이 방송은 사이트 안에서 재생할 수 없어 원본 페이지로 이동합니다</span>
            </span>
          </a>
        ) : (
          <OfflineScreen b={b} />
        )}
      </div>
      {live && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-dim">
          <span>
            {b.embedUrl ? `${platform} 플레이어 · 소리는 플레이어에서 켜주세요` : `${platform} 원본 방송`}
            {b.description ? ` · ${b.description}` : ""}
          </span>
          <a href={b.url!} target="_blank" rel="noopener noreferrer" className="font-semibold text-muted hover:text-ink">
            {platform}에서 열기 ↗ {b.embedUrl ? "(재생이 안 되면)" : ""}
          </a>
        </div>
      )}
    </div>
  );
}

function OfflineScreen({ b }: { b: PublicBroadcast }) {
  return (
    <div className="ops-grid absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,#141d2e_0%,#070b14_75%)] p-4 text-center">
      {b.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      )}
      <div className="relative flex items-center gap-2 sm:gap-3">
        <span className="rounded-sm bg-alert px-2 py-1 font-mono text-sm font-black text-white sm:text-2xl">RWN</span>
        <span className="text-xl font-black sm:text-4xl">
          RUST WAR <span className="text-alert">NEWS</span>
        </span>
      </div>
      <p className="relative max-w-lg whitespace-pre-line text-sm text-muted sm:text-base">{b.offlineMessage}</p>
      <span className="relative font-mono text-xs tracking-widest text-dim">{b.status === "STANDBY" ? "STANDBY" : b.status === "OFFLINE" ? "OFF AIR" : "STATUS UNKNOWN"}</span>
    </div>
  );
}
