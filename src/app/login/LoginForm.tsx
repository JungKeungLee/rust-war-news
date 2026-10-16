"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "로그인에 실패했습니다.");
    // 임시 비밀번호 계정은 비밀번호 변경 화면으로
    window.location.assign(json.mustChangePassword ? `/account/password?next=${encodeURIComponent(next)}` : next);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <label className="lbl" htmlFor="email">
          이메일
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label className="lbl" htmlFor="password">
          비밀번호
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {error && <p className="rounded border border-alert/50 bg-alert/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <button className="btn btn-red mt-1" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
