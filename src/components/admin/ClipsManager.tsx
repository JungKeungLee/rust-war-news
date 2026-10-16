"use client";

import { useState } from "react";
import { usePolling } from "@/lib/live/client";
import { fmtRelative } from "@/lib/format";
import { CLIP_PLATFORM_LABEL, CLIP_STATUS_LABEL } from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { Field, IncidentSelect, StatusPill, Toggle } from "./forms";

type Clip = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  platform: keyof typeof CLIP_PLATFORM_LABEL;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  teamId: string | null;
  playerId: string | null;
  incidentId: string | null;
  submitterNickname: string | null;
  isAnonymous: boolean;
  status: keyof typeof CLIP_STATUS_LABEL;
  isHot: boolean;
  rejectReason: string | null;
  version: number;
  createdAt: string;
  teamName: string | null;
  playerName: string | null;
  incidentTitle: string | null;
};

type Incident = { id: string; title: string; verificationStatus: string; isClosed: boolean };

export function ClipsManager({ incidents, teams }: { incidents: Incident[]; teams: { id: string; name: string }[] }) {
  const { data, refresh } = usePolling<{ items: Clip[] }>("/api/admin/clips", { intervalMs: 8000 });
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const items = (data?.items ?? []).filter((c) => filter === "ALL" || c.status === filter);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? "border-alert bg-alert/15" : ""}`} onClick={() => setFilter(f)}>
              {f === "ALL" ? "전체" : CLIP_STATUS_LABEL[f]} {data ? `(${data.items.filter((c) => f === "ALL" || c.status === f).length})` : ""}
            </button>
          ))}
        </div>
        {!data && <div className="panel h-40 animate-pulse" />}
        {data && items.length === 0 && <div className="panel p-6 text-center text-muted">클립이 없습니다.</div>}
        {items.map((c) => (
          <ClipRow key={`${c.id}:${c.version}`} c={c} incidents={incidents} teams={teams} onChanged={refresh} />
        ))}
      </div>
      <NewClipForm incidents={incidents} teams={teams} onCreated={refresh} />
    </div>
  );
}

function ClipRow({ c, incidents, teams, onChanged }: { c: Clip; incidents: Incident[]; teams: { id: string; name: string }[]; onChanged: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ title: c.title, embedUrl: c.embedUrl ?? "", thumbnailUrl: c.thumbnailUrl ?? "", incidentId: c.incidentId, teamId: c.teamId ?? "", rejectReason: "" });

  async function patch(action: string, extra: Record<string, unknown> = {}, msg = "저장했습니다.") {
    try {
      await api("PATCH", `/api/admin/clips/${c.id}`, { version: c.version, action, ...extra });
      toast(msg);
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  }

  return (
    <article className="panel flex flex-col gap-3 p-3 sm:flex-row">
      <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0">
        {c.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="aspect-video w-full rounded object-cover sm:w-48" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded bg-panel2 text-xs text-dim sm:w-48">{CLIP_PLATFORM_LABEL[c.platform]}</div>
        )}
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <StatusPill tone={c.status === "APPROVED" ? "green" : c.status === "REJECTED" ? "red" : "amber"}>{CLIP_STATUS_LABEL[c.status]}</StatusPill>
          <StatusPill>{CLIP_PLATFORM_LABEL[c.platform]}</StatusPill>
          {c.embedUrl ? <StatusPill tone="blue">임베드</StatusPill> : <StatusPill>외부 링크</StatusPill>}
          {c.isHot && <StatusPill tone="red">HOT</StatusPill>}
          <span className="font-mono text-xs text-dim">{fmtRelative(c.createdAt)}</span>
        </div>
        <div className="mt-1 font-bold">{c.title}</div>
        <div className="truncate text-xs text-dim">
          {c.url} · 제보 {c.isAnonymous ? "익명" : (c.submitterNickname ?? "-")}
          {c.teamName && ` · ${c.teamName}`}
          {c.playerName && ` · ${c.playerName}`}
          {c.incidentTitle && ` · 사건: ${c.incidentTitle}`}
        </div>
        {c.rejectReason && <p className="mt-1 text-xs text-red-300">반려 사유: {c.rejectReason}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.status !== "APPROVED" && (
            <button className="btn btn-sm btn-blue" onClick={() => patch("approve", {}, "승인했습니다.")}>
              승인
            </button>
          )}
          {c.status === "APPROVED" && (
            <Toggle checked={c.isHot} onChange={(v) => patch("update", { isHot: v }, v ? "핫 클립으로 선정했습니다." : "핫 클립 해제")} label="핫 클립" />
          )}
          <button className="btn btn-sm" onClick={() => setEdit((v) => !v)}>
            편집·반려
          </button>
        </div>
        {edit && (
          <div className="mt-3 grid gap-2 rounded border border-line p-3 md:grid-cols-2">
            <Field label="제목" className="md:col-span-2">
              <input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} />
            </Field>
            <Field label="임베드 주소 (허용 도메인만)" className="md:col-span-2" hint="비우면 외부 링크로 표시">
              <input className="field" value={f.embedUrl} onChange={(e) => setF({ ...f, embedUrl: e.target.value })} placeholder="https://www.youtube-nocookie.com/embed/..." />
            </Field>
            <Field label="썸네일 주소">
              <input className="field" value={f.thumbnailUrl} onChange={(e) => setF({ ...f, thumbnailUrl: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="관련 팀">
              <select className="field" value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })}>
                <option value="">없음</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="관련 사건" className="md:col-span-2">
              <IncidentSelect value={f.incidentId} onChange={(v) => setF({ ...f, incidentId: v })} incidents={incidents} />
            </Field>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                className="btn btn-sm btn-red"
                onClick={() => patch("update", { title: f.title, embedUrl: f.embedUrl || null, thumbnailUrl: f.thumbnailUrl || null, incidentId: f.incidentId, teamId: f.teamId || null })}
              >
                저장
              </button>
              <input className="field max-w-xs py-1 text-sm" placeholder="반려 사유" value={f.rejectReason} onChange={(e) => setF({ ...f, rejectReason: e.target.value })} />
              <button className="btn btn-sm" disabled={!f.rejectReason.trim()} onClick={() => patch("reject", { rejectReason: f.rejectReason }, "반려했습니다.")}>
                반려
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function NewClipForm({ incidents, teams, onCreated }: { incidents: Incident[]; teams: { id: string; name: string }[]; onCreated: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [f, setF] = useState({ title: "", url: "", description: "", teamId: "", incidentId: null as string | null });
  return (
    <section className="panel flex flex-col gap-3 self-start p-4">
      <h2 className="font-bold">클립 직접 등록 (즉시 승인)</h2>
      <Field label="영상 주소">
        <input className="field" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" />
      </Field>
      <Field label="제목">
        <input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} />
      </Field>
      <Field label="관련 팀">
        <select className="field" value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })}>
          <option value="">없음</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="관련 사건">
        <IncidentSelect value={f.incidentId} onChange={(v) => setF({ ...f, incidentId: v })} incidents={incidents} />
      </Field>
      <button
        className="btn btn-red"
        disabled={!f.url.trim() || !f.title.trim()}
        onClick={async () => {
          try {
            await api("POST", "/api/admin/clips", { ...f, teamId: f.teamId || null, playerId: null });
            toast("클립을 등록했습니다.");
            setF({ title: "", url: "", description: "", teamId: "", incidentId: null });
            onCreated();
          } catch (e) {
            onError(e);
          }
        }}
      >
        등록
      </button>
    </section>
  );
}
