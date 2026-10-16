"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/live/client";
import { fmtDuration } from "@/lib/format";
import { RUNDOWN_KIND_LABEL } from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import type { EpisodeFullJson } from "./episode-types";

const PREF_KEY = "rwn-prompter";

/**
 * 프롬프터: 큰 글씨, 글자 크기·줄 간격 조절, 전체 화면, 진행자별 대본 필터, 현재 진행 순서 표시.
 * 3초마다 큐 상태를 갱신하고 현재 항목으로 자동 스크롤한다.
 */
export function Prompter({ initial, defaultAnchor }: { initial: EpisodeFullJson; defaultAnchor: string }) {
  const { api, can } = useAdmin();
  const onError = useApiErrorHandler();
  const { data, refresh } = usePolling<EpisodeFullJson>(`/api/admin/episodes/${initial.episode.id}`, { initial, intervalMs: 3000, pauseHidden: false });
  const { episode: ep, items, anchors } = data ?? initial;
  const [anchor, setAnchor] = useState(defaultAnchor);
  const [fontSize, setFontSize] = useState(48);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [follow, setFollow] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 저장된 글자 크기·줄 간격 복원 (서버 렌더 값과의 불일치를 피하려 마운트 후 적용)
    let saved: { fontSize?: number; lineHeight?: number } = {};
    try {
      saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    } catch {
      /* 저장소 사용 불가 시 기본값 */
    }
    const id = requestAnimationFrame(() => {
      if (saved.fontSize) setFontSize(saved.fontSize);
      if (saved.lineHeight) setLineHeight(saved.lineHeight);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ fontSize, lineHeight }));
    } catch {
      /* ignore */
    }
  }, [fontSize, lineHeight]);

  useEffect(() => {
    if (follow && currentRef.current) currentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ep.currentItemId, follow]);

  const visible = items.filter((i) => i.status !== "SKIPPED" && (anchor === "all" || i.anchorId === anchor || i.scripts.some((s) => s.anchorId === anchor)));
  const currentIdx = items.findIndex((i) => i.id === ep.currentItemId);

  async function cue(action: "next" | "prev") {
    try {
      await api("POST", `/api/admin/episodes/${ep.id}/cue`, { action, expectedCurrentId: ep.currentItemId });
    } catch (e) {
      onError(e);
    } finally {
      refresh();
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/15 bg-[#0b0b0b] px-4 py-2 text-sm">
        <Link href={`/admin/episodes/${ep.id}`} className="text-white/60 hover:text-white">
          ← 큐시트
        </Link>
        <span className="font-bold">{ep.title}</span>
        {ep.status === "LIVE" ? <span className="rounded bg-alert px-2 py-0.5 text-xs font-black">ON AIR</span> : <span className="text-white/50">방송 대기</span>}
        <span className="font-mono text-white/70">
          {currentIdx >= 0 ? `${currentIdx + 1} / ${items.length}` : `- / ${items.length}`}
        </span>
        <select value={anchor} onChange={(e) => setAnchor(e.target.value)} className="rounded border border-white/20 bg-black px-2 py-1" aria-label="진행자 필터">
          <option value="all">전체 진행자</option>
          {anchors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName} 대본만
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          글자
          <input type="range" min={24} max={120} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
          <span className="w-8 font-mono">{fontSize}</span>
        </label>
        <label className="flex items-center gap-1">
          줄간격
          <input type="range" min={1.1} max={2.6} step={0.1} value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} />
          <span className="w-8 font-mono">{lineHeight.toFixed(1)}</span>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 현재 항목 따라가기
        </label>
        <div className="ml-auto flex gap-2">
          {can("rundown.operate") && ep.status === "LIVE" && (
            <>
              <button className="rounded border border-white/30 px-3 py-1" onClick={() => cue("prev")}>
                ◀ 이전
              </button>
              <button className="rounded bg-alert px-3 py-1 font-bold" onClick={() => cue("next")}>
                다음 ▶
              </button>
            </>
          )}
          <button className="rounded border border-white/30 px-3 py-1" onClick={toggleFullscreen}>
            전체 화면
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-[6vw] py-[20vh]">
        {visible.length === 0 && <p className="text-center text-2xl text-white/50">표시할 대본이 없습니다.</p>}
        {visible.map((it) => {
          const isCurrent = it.id === ep.currentItemId;
          const done = it.status === "DONE";
          const scripts = it.scripts.filter((s) => (anchor === "all" || s.anchorId === anchor) && s.body.trim());
          return (
            <section
              key={it.id}
              ref={(el) => {
                if (isCurrent) currentRef.current = el;
              }}
              className={`mb-[12vh] scroll-mt-[15vh] ${done ? "opacity-35" : ""}`}
            >
              <div className={`mb-4 flex items-center gap-3 text-xl ${isCurrent ? "text-alert" : "text-white/50"}`}>
                <span className="font-mono font-black">{items.indexOf(it) + 1}</span>
                <span>[{RUNDOWN_KIND_LABEL[it.kind]}]</span>
                <span className="font-bold">{it.title}</span>
                {it.anchorName && <span style={{ color: it.anchorColor ?? undefined }}>🎙 {it.anchorName}</span>}
                <span className="font-mono text-base">{fmtDuration(it.plannedSeconds)}</span>
                {isCurrent && <span className="rounded bg-alert px-2 text-base font-black text-white">NOW</span>}
              </div>
              {scripts.length === 0 ? (
                <p className="text-2xl italic text-white/30">(대본 없음)</p>
              ) : (
                scripts.map((s) => {
                  const a = anchors.find((x) => x.id === s.anchorId);
                  return (
                    <div key={s.id} className="mb-8">
                      {anchor === "all" && (
                        <div className="mb-2 text-lg font-bold" style={{ color: a?.color ?? "#9aa6bd" }}>
                          {a?.displayName ?? "진행자"}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap font-semibold" style={{ fontSize, lineHeight }}>
                        {s.body}
                      </p>
                    </div>
                  );
                })
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
