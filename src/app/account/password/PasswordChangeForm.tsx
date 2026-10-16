"use client";

import { useEffect, useState } from "react";

export function PasswordChangeForm({ next }: { next: string }) {
  const [csrf, setCsrf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCsrf(j.csrfToken ?? null))
      .catch(() => setError("세션 정보를 불러오지 못했습니다. 새로고침하세요."));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("newPassword") ?? "");
    if (newPassword !== String(fd.get("confirm") ?? "")) return setError("새 비밀번호 확인이 일치하지 않습니다.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf ?? "" },
      body: JSON.stringify({ currentPassword: fd.get("currentPassword"), newPassword }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "비밀번호 변경에 실패했습니다.");
    setDone(true);
    setTimeout(() => window.location.assign(next), 1200);
  }

  if (done) return <p className="rounded border border-ok/50 bg-ok/10 px-3 py-3 text-sm text-ok">비밀번호를 변경했습니다. 다른 기기의 로그인은 모두 종료되었습니다. 이동 중…</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <label className="lbl" htmlFor="currentPassword">
          현재 비밀번호 (임시 비밀번호)
        </label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="field" />
      </div>
      <div>
        <label className="lbl" htmlFor="newPassword">
          새 비밀번호
        </label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className="field" />
        <p className="mt-1 text-xs text-dim">10자 이상, 문자와 숫자 포함. 이메일 아이디는 사용할 수 없습니다.</p>
      </div>
      <div>
        <label className="lbl" htmlFor="confirm">
          새 비밀번호 확인
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
      </div>
      {error && <p className="rounded border border-alert/50 bg-alert/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      <button className="btn btn-red mt-1" disabled={busy || !csrf}>
        {busy ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
