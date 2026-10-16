"use client";

import { useState } from "react";
import { usePolling } from "@/lib/live/client";
import { fmtDateTime } from "@/lib/format";
import { POLL_STATUS_LABEL } from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { DateTimeInput, Field, StatusPill, Toggle } from "./forms";

type Poll = {
  id: string;
  question: string;
  description: string | null;
  status: keyof typeof POLL_STATUS_LABEL;
  resultVisibility: "ALWAYS" | "AFTER_VOTE" | "AFTER_CLOSE";
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  options: { id: string; label: string; votes: number }[];
};

export function PollsManager() {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const { data, refresh } = usePolling<{ items: Poll[] }>("/api/admin/polls", { intervalMs: 5000 });
  const [f, setF] = useState({
    question: "",
    description: "",
    options: ["", ""],
    resultVisibility: "AFTER_VOTE" as Poll["resultVisibility"],
    startsAt: null as string | null,
    endsAt: null as string | null,
    open: true,
  });

  async function act(p: Poll, action: string) {
    try {
      await api("PATCH", `/api/admin/polls/${p.id}`, { version: p.version, action });
      toast(action === "close" ? "투표를 종료했습니다." : "투표를 시작했습니다.");
    } catch (e) {
      onError(e);
    } finally {
      refresh();
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-3">
        {data?.items.length === 0 && <div className="panel p-6 text-center text-muted">투표가 없습니다.</div>}
        {data?.items.map((p) => {
          const total = p.options.reduce((s, o) => s + o.votes, 0);
          return (
            <article key={`${p.id}:${p.version}`} className="panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={p.status === "OPEN" ? "red" : "default"}>{POLL_STATUS_LABEL[p.status]}</StatusPill>
                <span className="font-bold">{p.question}</span>
                <span className="ml-auto font-mono text-xs text-dim">
                  {fmtDateTime(p.startsAt)} ~ {fmtDateTime(p.endsAt)}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {p.options.map((o) => {
                  const pct = total ? Math.round((o.votes / total) * 100) : 0;
                  return (
                    <li key={o.id} className="relative overflow-hidden rounded border border-line px-3 py-1.5 text-sm">
                      <span className="absolute inset-y-0 left-0 bg-intel/20" style={{ width: `${pct}%` }} />
                      <span className="relative flex justify-between">
                        <span>{o.label}</span>
                        <span className="font-mono">
                          {o.votes}표 · {pct}%
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex gap-2">
                {p.status !== "OPEN" && (
                  <button className="btn btn-sm btn-red" onClick={() => act(p, p.status === "DRAFT" ? "open" : "reopen")}>
                    {p.status === "DRAFT" ? "시작" : "다시 열기"}
                  </button>
                )}
                {p.status === "OPEN" && (
                  <button className="btn btn-sm" onClick={() => act(p, "close")}>
                    종료
                  </button>
                )}
                <span className="ml-auto self-center text-xs text-dim">총 {total}표</span>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel flex flex-col gap-3 self-start p-4">
        <h2 className="font-bold">새 투표</h2>
        <Field label="질문">
          <input className="field" value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} maxLength={150} />
        </Field>
        <Field label="설명">
          <input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} />
        </Field>
        <Field label="보기">
          <div className="flex flex-col gap-1">
            {f.options.map((o, i) => (
              <div key={i} className="flex gap-1">
                <input className="field py-1" value={o} onChange={(e) => setF({ ...f, options: f.options.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={80} placeholder={`보기 ${i + 1}`} />
                {f.options.length > 2 && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {f.options.length < 10 && (
              <button className="btn btn-sm self-start" onClick={() => setF({ ...f, options: [...f.options, ""] })}>
                + 보기
              </button>
            )}
          </div>
        </Field>
        <Field label="결과 공개">
          <select className="field" value={f.resultVisibility} onChange={(e) => setF({ ...f, resultVisibility: e.target.value as Poll["resultVisibility"] })}>
            <option value="AFTER_VOTE">투표 후 공개</option>
            <option value="ALWAYS">항상 공개</option>
            <option value="AFTER_CLOSE">종료 후 공개</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="시작">
            <DateTimeInput value={f.startsAt} onChange={(v) => setF({ ...f, startsAt: v })} />
          </Field>
          <Field label="종료">
            <DateTimeInput value={f.endsAt} onChange={(v) => setF({ ...f, endsAt: v })} />
          </Field>
        </div>
        <Toggle checked={f.open} onChange={(v) => setF({ ...f, open: v })} label="만들면서 바로 시작" />
        <button
          className="btn btn-red"
          disabled={!f.question.trim() || f.options.filter((o) => o.trim()).length < 2}
          onClick={async () => {
            try {
              await api("POST", "/api/admin/polls", { ...f, options: f.options.filter((o) => o.trim()), eventId: null });
              toast("투표를 만들었습니다.");
              setF({ ...f, question: "", description: "", options: ["", ""] });
              refresh();
            } catch (e) {
              onError(e);
            }
          }}
        >
          투표 만들기
        </button>
      </section>
    </div>
  );
}
