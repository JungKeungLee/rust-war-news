"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { OverlayResponse, PublicLiveState } from "./types";

export const LIVE_POLL_MS = Number(process.env.NEXT_PUBLIC_LIVE_POLL_MS ?? 5000);
export const OVERLAY_POLL_MS = 4000;
const MAX_BACKOFF_MS = 60_000;

export type PollStatus = "idle" | "checking" | "ok" | "error" | "paused";

/**
 * 실시간 전송 계층 (현재: HTTP 폴링).
 *  - ETag/If-None-Match 로 변경이 없으면 304(본문 없음)를 받아 응답을 최소화
 *  - 언마운트·주소 변경 시 진행 중 요청 취소(AbortController)
 *  - 실패 시 지수 백오프(최대 60초), 마지막 정상 데이터 유지
 *  - 숨겨진 탭에서는 중단, 다시 보이면 즉시 최신 데이터 조회
 * 외부 메시징 서비스로 교체할 때는 이 훅 내부만 바꾸면 화면 코드는 그대로 둘 수 있다.
 * url 이 null 이면 비활성.
 */
export function usePolling<T>(url: string | null, opts: { intervalMs?: number; initial?: T | null; pauseHidden?: boolean } = {}) {
  const { intervalMs = LIVE_POLL_MS, initial = null, pauseHidden = true } = opts;
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [status, setStatus] = useState<PollStatus>(initial ? "ok" : "idle");
  const etag = useRef<string | null>(null);
  const failures = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(() => runRef.current(), []);

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    etag.current = null;
    failures.current = 0;

    const hidden = () => pauseHidden && document.visibilityState === "hidden";
    const schedule = () => {
      clearTimeout(timer);
      if (stopped || hidden()) return; // 숨김 상태면 다시 보일 때 재개
      const delay = failures.current ? Math.min(intervalMs * 2 ** failures.current, MAX_BACKOFF_MS) : intervalMs;
      timer = setTimeout(run, delay);
    };

    async function run() {
      if (stopped) return;
      if (hidden()) {
        setStatus("paused");
        return;
      }
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      setStatus("checking");
      try {
        const headers: Record<string, string> = { accept: "application/json" };
        if (etag.current) headers["if-none-match"] = etag.current;
        const res = await fetch(url!, { cache: "no-store", headers, signal: ac.signal });
        if (res.status !== 304) {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as T;
          etag.current = res.headers.get("etag");
          if (!stopped) setData(json);
        }
        failures.current = 0;
        if (!stopped) {
          setError(null);
          setLastOk(Date.now());
          setStatus("ok");
        }
      } catch (e) {
        if (ac.signal.aborted || stopped) return;
        failures.current += 1;
        setError(e instanceof Error ? e.message : "연결 오류");
        setStatus("error");
      } finally {
        if (controller.current === ac) controller.current = null;
        schedule();
      }
    }
    runRef.current = run;

    const onVis = () => {
      if (document.visibilityState === "visible") {
        failures.current = 0;
        clearTimeout(timer);
        run();
      } else if (pauseHidden) {
        clearTimeout(timer);
        controller.current?.abort();
        setStatus("paused");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    // 서버 렌더 데이터가 있으면 한 주기 뒤부터, 없으면 즉시 조회
    if (initial) schedule();
    else run();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.current?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
    // initial 은 첫 렌더 값만 의미가 있으므로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs, pauseHidden]);

  return { data, error, lastOk, status, refresh };
}

type LiveCtxValue = ReturnType<typeof usePolling<PublicLiveState>>;
const LiveCtx = createContext<LiveCtxValue | null>(null);

/** 사이트 전체에서 /api/live 폴링을 하나로 공유 (티커·LIVE 표시·플레이어·속보 목록) */
export function LiveStateProvider({ initial, children }: { initial: PublicLiveState; children: React.ReactNode }) {
  const value = usePolling<PublicLiveState>("/api/live", { initial, intervalMs: LIVE_POLL_MS });
  return createElement(LiveCtx.Provider, { value }, children);
}

/** 공유 상태가 있으면 그것을, 없으면(관리자 화면 등) 자체 폴링 */
export function useLiveState(initial: PublicLiveState | null) {
  const shared = useContext(LiveCtx);
  const own = usePolling<PublicLiveState>(shared ? null : "/api/live", { initial });
  return shared ?? own;
}

/** OBS 는 화면이 숨겨진 상태로 판정될 수 있으므로 일시정지하지 않는다. 주기 4초 유지 */
export function useOverlay(key: string) {
  return usePolling<OverlayResponse>(`/api/overlay/${key}`, { intervalMs: OVERLAY_POLL_MS, pauseHidden: false });
}
