"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function ClipForm({ teams, players }: { teams: { id: string; name: string }[]; players: { id: string; nickname: string }[] }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string }>({ status: "idle" });
  const [anonymous, setAnonymous] = useState(false);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          url: fd.get("url"),
          description: fd.get("description"),
          teamId: fd.get("teamId") || null,
          playerId: fd.get("playerId") || null,
          nickname: fd.get("nickname"),
          isAnonymous: anonymous,
          website: fd.get("website"),
          elapsedMs: Date.now() - startedAt.current,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "접수에 실패했습니다.");
      setState({ status: "done" });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "오류" });
    }
  }

  if (state.status === "done") {
    return (
      <div className="panel border-ok/50 p-6 text-center">
        <h2 className="text-xl font-black">클립이 접수되었습니다</h2>
        <p className="mt-2 text-sm text-muted">운영진 승인 후 핫 클립 페이지에 공개됩니다.</p>
        <Link href="/clips" className="btn mt-4">
          핫 클립 보기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel flex flex-col gap-5 p-4 sm:p-6">
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="lbl" htmlFor="url">
          영상 주소 *
        </label>
        <input id="url" name="url" type="url" inputMode="url" required maxLength={500} className="field" placeholder="https://www.youtube.com/watch?v=… / https://vod.sooplive.co.kr/…" />
      </div>
      <div>
        <label className="lbl" htmlFor="title">
          클립 제목 *
        </label>
        <input id="title" name="title" required minLength={2} maxLength={100} className="field" />
      </div>
      <div>
        <label className="lbl" htmlFor="description">
          설명
        </label>
        <textarea id="description" name="description" maxLength={1000} className="field min-h-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl" htmlFor="teamId">
            관련 팀
          </label>
          <select id="teamId" name="teamId" className="field">
            <option value="">선택 안 함</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="playerId">
            관련 선수
          </label>
          <select id="playerId" name="playerId" className="field">
            <option value="">선택 안 함</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl" htmlFor="nickname">
            제보자 닉네임
          </label>
          <input id="nickname" name="nickname" maxLength={30} disabled={anonymous} className="field" />
        </div>
        <label className="flex items-center gap-2 self-end rounded border border-line px-3 py-3 text-sm font-semibold">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 accent-alert" />
          익명으로 제보
        </label>
      </div>
      {state.status === "error" && <p className="rounded border border-alert/50 bg-alert/10 px-3 py-2 text-sm text-red-300">{state.message}</p>}
      <button type="submit" className="btn btn-red py-3 text-base" disabled={state.status === "sending"}>
        {state.status === "sending" ? "전송 중…" : "클립 보내기"}
      </button>
    </form>
  );
}
