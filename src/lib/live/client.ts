"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OverlayResponse, PublicLiveState } from "./types";

export const LIVE_POLL_MS = Number(process.env.NEXT_PUBLIC_LIVE_POLL_MS ?? 4000);

/**
 * 실시간 전송 계층 (현재: HTTP 폴링).
 * 외부 메시징 서비스로 교체할 때는 이 훅의 내부만 구독 방식으로 바꾸면 화면 코드는 그대로 둘 수 있다.
 */
export function usePolling<T>(url: string, opts: { intervalMs?: number; initial?: T | null; pauseHidden?: boolean } = {}) {
  const { intervalMs = LIVE_POLL_MS, initial = null, pauseHidden = true } = opts;
  const [data, setData] = useState<T | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as T);
      setError(null);
      setLastOk(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결 오류");
    } finally {
      inflight.current = false;
    }
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      if (!(pauseHidden && document.visibilityState === "hidden")) await refresh();
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, initial ? intervalMs : 0);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, intervalMs, pauseHidden, initial]);

  return { data, error, lastOk, refresh };
}

export function useLiveState(initial: PublicLiveState | null) {
  return usePolling<PublicLiveState>("/api/live", { initial });
}

/** OBS 는 화면이 숨겨진 상태로 판정될 수 있으므로 일시정지하지 않는다. */
export function useOverlay(key: string) {
  return usePolling<OverlayResponse>(`/api/overlay/${key}`, { pauseHidden: false });
}
