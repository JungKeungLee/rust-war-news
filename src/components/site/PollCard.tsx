"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";

type Props = {
  poll: { id: string; question: string; description: string | null; endsAt: string | null };
  options: { id: string; label: string; votes: number | null }[];
  open: boolean;
  myOptionId: string | null;
  resultNote: string | null;
};

export function PollCard({ poll, options, open, myOptionId, resultNote }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = options.reduce((s, o) => s + (o.votes ?? 0), 0);
  const canVote = open && !myOptionId;

  async function vote(optionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? "투표에 실패했습니다.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-black ${open ? "bg-alert text-white" : "bg-panel2 text-muted ring-1 ring-line"}`}>{open ? "진행 중" : "종료"}</span>
        {poll.endsAt && <span className="font-mono text-xs text-dim">마감 {fmtDateTime(poll.endsAt)}</span>}
      </div>
      <h2 className="text-lg font-extrabold">{poll.question}</h2>
      {poll.description && <p className="text-sm text-muted">{poll.description}</p>}
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const pct = o.votes != null && total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const mine = o.id === myOptionId;
          return (
            <li key={o.id}>
              <button
                disabled={!canVote || busy}
                onClick={() => vote(o.id)}
                className={`relative w-full overflow-hidden rounded border px-3 py-3 text-left font-semibold ${mine ? "border-alert" : "border-line"} ${canVote ? "hover:border-ink" : "cursor-default"}`}
              >
                {o.votes != null && <span className="absolute inset-y-0 left-0 bg-intel/15" style={{ width: `${pct}%` }} />}
                <span className="relative flex justify-between gap-2">
                  <span>
                    {mine && "✓ "}
                    {o.label}
                  </span>
                  {o.votes != null && (
                    <span className="font-mono text-sm text-muted">
                      {pct}% · {o.votes}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-alert">{error}</p>}
      {resultNote && <p className="text-xs text-dim">{resultNote}</p>}
      {options.some((o) => o.votes != null) && <p className="text-xs text-dim">총 {total}표</p>}
    </div>
  );
}
