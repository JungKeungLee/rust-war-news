"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOverlay } from "@/lib/live/client";
import type { OverlayState } from "@/lib/live/types";

type Of<K extends OverlayState["key"]> = Extract<OverlayState, { key: K }>;

/** 오버레이 공통: 상태 폴링 + 페이드 전환 + 미리보기 배경 */
function useOverlayState<K extends OverlayState["key"]>(key: K) {
  const { data } = useOverlay(key);
  return (data?.state as Of<K> | undefined) ?? null;
}

function PreviewBg() {
  const sp = useSearchParams();
  return sp.get("bg") === "1" ? <div className="overlay-preview-bg hidden" /> : null;
}

function Fade({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <div style={{ opacity: show ? 1 : 0, transition: "opacity 400ms ease" }}>{children}</div>;
}

const VERIFY_TAG: Record<string, string> = { UNVERIFIED: "미확인", VERIFYING: "확인 중", DISPUTED: "주장 엇갈림", FALSE: "사실 아님" };

/* ------------------------------ 속보 배너 ------------------------------ */
export function BreakingOverlay() {
  const s = useOverlayState("breaking");
  const item = s?.item;
  const urgent = item?.priority === "URGENT";
  return (
    <>
      <PreviewBg />
      <Fade show={!!s?.visible && !!item}>
        {item && (
          <div className="absolute bottom-[150px] left-[80px] right-[80px] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-stretch">
              <div className={`flex items-center px-8 text-[40px] font-black tracking-tight text-white ${urgent ? "bg-[#e5202e]" : "bg-[#b5121f]"}`}>{urgent ? "긴급 속보" : "속보"}</div>
              <div className="flex items-center gap-4 bg-[#070b14] px-6 text-[26px] font-bold text-white/80">
                RWN
                {VERIFY_TAG[item.verificationStatus] && <span className="rounded bg-[#f5a524] px-3 py-0.5 text-[24px] font-black text-black">{VERIFY_TAG[item.verificationStatus]}</span>}
                {item.correctedAt && <span className="rounded bg-[#3b82f6] px-3 py-0.5 text-[24px] font-black text-white">정정</span>}
              </div>
            </div>
            <div className="border-l-[12px] border-[#e5202e] bg-white/95 px-10 py-6">
              <div className="text-[64px] font-black leading-[1.15] text-[#070b14]">{item.title}</div>
              {item.body && <div className="mt-2 line-clamp-2 text-[32px] font-semibold leading-snug text-[#1f2a3d]">{item.body}</div>}
            </div>
          </div>
        )}
      </Fade>
    </>
  );
}

/* ------------------------------ 하단 티커 ------------------------------ */
export function TickerOverlay() {
  const s = useOverlayState("ticker");
  const items = s?.items ?? [];
  const textLen = items.reduce((n, i) => n + i.text.length + 8, 0);
  const duration = Math.max(20, Math.round(textLen * 0.35));
  return (
    <>
      <PreviewBg />
      <Fade show={!!s?.visible}>
        <div className="absolute bottom-0 left-0 right-0 flex h-[72px] items-stretch bg-[#070b14]/95 text-white">
          <div className="z-10 flex items-center bg-[#e5202e] px-8 text-[34px] font-black">RWN</div>
          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-y-0 flex items-center whitespace-nowrap" style={{ animation: `rwn-marquee ${duration}s linear infinite` }}>
              {[0, 1].map((dup) => (
                <span key={dup} className="flex items-center">
                  {items.map((it, i) => (
                    <span key={`${dup}-${i}`} className="mx-10 flex items-center gap-4 text-[34px] font-bold">
                      <span className={`rounded px-3 py-0.5 text-[24px] font-black ${it.urgent ? "bg-[#e5202e]" : "bg-white/15"}`}>{it.label}</span>
                      {it.text}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Fade>
      <style>{`@keyframes rwn-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </>
  );
}

/* ------------------------------ 헤드라인 ------------------------------ */
export function HeadlineOverlay() {
  const s = useOverlayState("headline");
  return (
    <>
      <PreviewBg />
      <Fade show={!!s?.visible}>
        {s && (
          <div className="absolute left-[80px] top-[70px] max-w-[1300px] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="inline-block bg-[#e5202e] px-6 py-2 text-[30px] font-black text-white">{s.label}</div>
            <div className="bg-[#070b14]/92 px-8 py-5">
              <div className="text-[60px] font-black leading-[1.15] text-white">{s.title}</div>
              {s.subtitle && <div className="mt-2 line-clamp-2 text-[30px] font-medium text-white/75">{s.subtitle}</div>}
            </div>
          </div>
        )}
      </Fade>
    </>
  );
}

/* ------------------------------ 하단 자막 ------------------------------ */
export function LowerThirdOverlay() {
  const s = useOverlayState("lower_third");
  const color = s?.color ?? "#e5202e";
  return (
    <>
      <PreviewBg />
      <Fade show={!!s?.visible}>
        {s && (
          <div className="absolute bottom-[130px] left-[80px] flex items-stretch shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="w-[14px]" style={{ background: color }} />
            <div className="bg-white/95 px-10 py-4">
              <div className="text-[56px] font-black leading-tight text-[#070b14]">{s.name}</div>
              {s.role && <div className="text-[28px] font-bold text-[#475569]">{s.role}</div>}
            </div>
            <div className="flex items-center bg-[#070b14] px-6 text-[28px] font-black text-white">
              RW<span className="text-[#e5202e]">N</span>
            </div>
          </div>
        )}
      </Fade>
    </>
  );
}

/* ------------------------------ 전쟁 현황판 ------------------------------ */
export function WarStatusOverlay() {
  const s = useOverlayState("war_status");
  const max = Math.max(1, ...(s?.teams ?? []).map((t) => t.score));
  return (
    <>
      <PreviewBg />
      <Fade show={!!s?.visible}>
        {s && (
          <div className="absolute right-[60px] top-[70px] w-[620px] bg-[#070b14]/92 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between bg-[#e5202e] px-6 py-3">
              <span className="text-[32px] font-black text-white">{s.title}</span>
              <span className="font-mono text-[22px] font-bold text-white/80">WAR STATUS</span>
            </div>
            <ol className="flex flex-col gap-1 p-4">
              {s.teams.map((t, i) => (
                <li key={t.id} className={`flex items-center gap-4 px-2 py-2 ${t.isEliminated ? "opacity-40" : ""}`}>
                  <span className="w-8 font-mono text-[28px] font-black text-white/50">{i + 1}</span>
                  <span className="h-[44px] w-[10px]" style={{ background: t.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-[32px] font-black text-white ${t.isEliminated ? "line-through" : ""}`}>{t.name}</span>
                      <span className="font-mono text-[32px] font-black text-white">{t.score}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <div className="h-[8px] flex-1 bg-white/10">
                        <div className="h-full" style={{ width: `${Math.max(2, (t.score / max) * 100)}%`, background: t.color }} />
                      </div>
                      {t.statusLabel && <span className="text-[22px] font-bold text-white/70">{t.statusLabel}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Fade>
    </>
  );
}

/* ------------------------------ 대기 화면 ------------------------------ */
export function StandbyOverlay() {
  const s = useOverlayState("standby");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remain = s?.startsAt ? Math.max(0, Math.floor((new Date(s.startsAt).getTime() - now) / 1000)) : null;
  const hh = remain != null ? Math.floor(remain / 3600) : 0;
  const mm = remain != null ? Math.floor((remain % 3600) / 60) : 0;
  const ss = remain != null ? remain % 60 : 0;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <PreviewBg />
      <Fade show={!!s?.visible}>
        {s && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-white"
            style={{ background: "radial-gradient(ellipse at center, rgba(20,29,46,0.96) 0%, rgba(7,11,20,0.98) 70%)" }}
          >
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
            <div className="relative flex items-center gap-6">
              <span className="bg-[#e5202e] px-6 py-2 font-mono text-[64px] font-black">RWN</span>
              <span className="text-[72px] font-black tracking-tight">
                RUST WAR <span className="text-[#e5202e]">NEWS</span>
              </span>
            </div>
            <div className="relative mt-16 text-[56px] font-black">{s.title}</div>
            {s.message && <div className="relative mt-4 text-[34px] font-semibold text-white/70">{s.message}</div>}
            {remain != null && remain > 0 && (
              <div className="relative mt-12 font-mono text-[120px] font-black tabular-nums tracking-wider">
                {hh > 0 && `${pad(hh)}:`}
                {pad(mm)}:{pad(ss)}
              </div>
            )}
            <div className="absolute bottom-[60px] text-[22px] text-white/40">시청자 참여형 Rust 대결 팬 뉴스 · 공식 게임 방송이 아닙니다</div>
          </div>
        )}
      </Fade>
    </>
  );
}
