"use client";

import { useState } from "react";

/** 오보·권리 침해 신고 */
export function FlagButton({ targetType, targetId }: { targetType: "article" | "clip" | "report"; targetId: string }) {
  const [state, setState] = useState<"idle" | "open" | "sent" | "error">("idle");
  const [reason, setReason] = useState("");

  async function submit() {
    const res = await fetch("/api/flags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    setState(res.ok ? "sent" : "error");
  }

  if (state === "sent") return <p className="text-sm text-ok">신고가 접수되었습니다. 운영진이 확인합니다.</p>;
  if (state === "idle")
    return (
      <button onClick={() => setState("open")} className="text-sm text-dim underline hover:text-muted">
        오보·권리 침해 신고
      </button>
    );
  return (
    <div className="flex flex-col gap-2">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="field min-h-20 text-sm" placeholder="신고 사유를 적어주세요" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={reason.trim().length < 2} className="btn btn-sm">
          신고 보내기
        </button>
        <button onClick={() => setState("idle")} className="btn btn-sm btn-ghost">
          취소
        </button>
      </div>
      {state === "error" && <p className="text-sm text-alert">신고 접수에 실패했습니다.</p>}
    </div>
  );
}
