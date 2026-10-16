"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { hasPermission, type Permission, type RoleCode } from "@/lib/auth/permissions";

export type AdminUser = { id: string; email: string; displayName: string; roles: RoleCode[] };

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
  get isConflict() {
    return this.status === 409;
  }
}

type Toast = { id: number; tone: "ok" | "error" | "info"; text: string };

type Ctx = {
  user: AdminUser;
  can: (perm: Permission) => boolean;
  api: <T = Record<string, unknown>>(method: string, url: string, body?: unknown) => Promise<T>;
  upload: (file: File) => Promise<{ id: string; url: string }>;
  toast: (text: string, tone?: Toast["tone"]) => void;
};

const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ user, csrfToken, children }: { user: AdminUser; csrfToken: string; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3000);
  }, []);

  const api = useCallback(
    async <T,>(method: string, url: string, body?: unknown): Promise<T> => {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
      if (!res.ok) throw new ApiClientError(res.status, String(json.error ?? `요청 실패 (${res.status})`), json);
      return json as T;
    },
    [csrfToken],
  );

  const upload = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", headers: { "x-csrf-token": csrfToken }, body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiClientError(res.status, json.error ?? "업로드 실패", json);
      return json as { id: string; url: string };
    },
    [csrfToken],
  );

  const value = useMemo<Ctx>(() => ({ user, can: (p) => hasPermission(user.roles, p), api, upload, toast }), [user, api, upload, toast]);

  return (
    <AdminCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="assertive">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded border px-4 py-3 text-sm font-semibold shadow-2xl ${
              t.tone === "error" ? "border-alert bg-[#2a0b10] text-red-200" : t.tone === "info" ? "border-intel bg-[#0b1a33] text-blue-200" : "border-ok bg-[#0b2415] text-green-200"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </AdminCtx.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error("AdminProvider 가 필요합니다.");
  return ctx;
}

/** API 오류를 토스트로 표시. 409 충돌이면 안내 후 onConflict 실행(보통 새로고침). */
export function useApiErrorHandler() {
  const { toast } = useAdmin();
  return useCallback(
    (err: unknown, onConflict?: () => void) => {
      if (err instanceof ApiClientError) {
        toast(err.message, "error");
        if (err.isConflict) onConflict?.();
      } else toast(err instanceof Error ? err.message : "오류가 발생했습니다.", "error");
    },
    [toast],
  );
}

/** 마운트·의존성 변경 시 비동기 로드 실행 (오류는 토스트) */
export function useLoader(load: () => Promise<unknown>) {
  const onError = useApiErrorHandler();
  useEffect(() => {
    load().catch((e) => onError(e));
  }, [load, onError]);
}
