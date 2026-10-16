"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/live/client";
import { fmtDateTime } from "@/lib/format";
import { BREAKING_STATUS_LABEL, VERIFICATION_LABEL, type BreakingStatus, type Verification } from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { DateTimeInput, Field, IncidentSelect, StatusPill, Toggle, VerificationSelect } from "./forms";

export type BreakingItem = {
  id: string;
  title: string;
  body: string | null;
  priority: "URGENT" | "NORMAL";
  verificationStatus: Verification;
  status: BreakingStatus;
  isPinned: boolean;
  showOnOverlay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  correctedAt: string | null;
  correctionNote: string | null;
  convertedArticleId: string | null;
  incidentId: string | null;
  incidentTitle?: string | null;
  version: number;
  createdAt: string;
};

type Incident = { id: string; title: string; verificationStatus: string; isClosed: boolean };

/** 실제 공개 화면 노출 여부 (예약·자동 종료 반영) */
export function effectiveLive(b: Pick<BreakingItem, "status" | "startsAt" | "endsAt">, now = Date.now()) {
  return (
    (b.status === "LIVE" || b.status === "SCHEDULED") &&
    !!b.startsAt &&
    new Date(b.startsAt).getTime() <= now &&
    (!b.endsAt || new Date(b.endsAt).getTime() > now)
  );
}

export function BreakingManager({ incidents, defaultIncidentId }: { incidents: Incident[]; defaultIncidentId: string | null }) {
  const { data, refresh } = usePolling<{ items: BreakingItem[]; serverTime: string }>("/api/admin/breaking", { intervalMs: 5000 });
  const [filter, setFilter] = useState<"active" | "all">("active");
  const items = data?.items ?? [];
  const now = data ? new Date(data.serverTime).getTime() : 0;
  const shown = filter === "active" ? items.filter((b) => ["DRAFT", "SCHEDULED", "LIVE"].includes(b.status)) : items;

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <BreakingForm incidents={incidents} defaultIncidentId={defaultIncidentId} onCreated={refresh} />
      <section className="flex flex-col gap-3">
        <div className="flex gap-1">
          <button className={`btn btn-sm ${filter === "active" ? "border-alert bg-alert/15" : ""}`} onClick={() => setFilter("active")}>
            진행 중·예약·작성 중
          </button>
          <button className={`btn btn-sm ${filter === "all" ? "border-alert bg-alert/15" : ""}`} onClick={() => setFilter("all")}>
            전체 기록
          </button>
        </div>
        {!data && <div className="panel h-32 animate-pulse" />}
        {data && shown.length === 0 && <div className="panel p-6 text-center text-muted">속보가 없습니다.</div>}
        {shown.map((b) => (
          <BreakingRow key={`${b.id}:${b.version}`} b={b} now={now} onChanged={refresh} />
        ))}
      </section>
    </div>
  );
}

function BreakingForm({ incidents, defaultIncidentId, onCreated }: { incidents: Incident[]; defaultIncidentId: string | null; onCreated: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const initial = () => {
    const inc = incidents.find((i) => i.id === defaultIncidentId);
    return {
      title: inc?.title ?? "",
      body: "",
      priority: "NORMAL" as "URGENT" | "NORMAL",
      verificationStatus: (inc?.verificationStatus ?? "UNVERIFIED") as Verification,
      incidentId: defaultIncidentId,
      isPinned: false,
      showOnOverlay: true,
      startsAt: null as string | null,
      endsAt: null as string | null,
    };
  };
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(publish: "draft" | "now" | "schedule") {
    setBusy(true);
    try {
      await api("POST", "/api/admin/breaking", { ...f, publish });
      toast(publish === "now" ? "속보를 송출했습니다." : publish === "schedule" ? "예약했습니다." : "임시 저장했습니다.");
      setF({ ...initial(), incidentId: f.incidentId });
      onCreated();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-3 self-start p-4">
      <h2 className="font-bold">속보 작성</h2>
      <Field label="관련 사건">
        <IncidentSelect value={f.incidentId} onChange={(v) => set("incidentId", v)} incidents={incidents} />
      </Field>
      <Field label="제목 (티커·OBS에 표시)">
        <input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
      </Field>
      <Field label="내용">
        <textarea className="field min-h-20" value={f.body} onChange={(e) => set("body", e.target.value)} maxLength={1000} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="구분">
          <select className="field" value={f.priority} onChange={(e) => set("priority", e.target.value as "URGENT" | "NORMAL")}>
            <option value="NORMAL">일반</option>
            <option value="URGENT">긴급</option>
          </select>
        </Field>
        <Field label="확인 상태">
          <VerificationSelect value={f.verificationStatus} onChange={(v) => set("verificationStatus", v as Verification)} />
        </Field>
        <Field label="노출 시작 (예약)">
          <DateTimeInput value={f.startsAt} onChange={(v) => set("startsAt", v)} />
        </Field>
        <Field label="노출 종료 (자동 종료)">
          <DateTimeInput value={f.endsAt} onChange={(v) => set("endsAt", v)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4">
        <Toggle checked={f.isPinned} onChange={(v) => set("isPinned", v)} label="고정" />
        <Toggle checked={f.showOnOverlay} onChange={(v) => set("showOnOverlay", v)} label="OBS 노출" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-red" disabled={busy || !f.title.trim()} onClick={() => submit("now")}>
          즉시 송출
        </button>
        <button className="btn" disabled={busy || !f.title.trim() || !f.startsAt} onClick={() => submit("schedule")}>
          예약 발행
        </button>
        <button className="btn btn-ghost" disabled={busy || !f.title.trim()} onClick={() => submit("draft")}>
          임시 저장
        </button>
      </div>
    </section>
  );
}

export function BreakingRow({ b, now, onChanged, compact }: { b: BreakingItem; now: number; onChanged: () => void; compact?: boolean }) {
  const { api, toast } = useAdmin();
  const router = useRouter();
  const onError = useApiErrorHandler();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "correct" | "history">("none");
  const [corr, setCorr] = useState({ title: b.title, body: b.body ?? "", verificationStatus: b.verificationStatus, note: "" });
  const [history, setHistory] = useState<{ id: number; action: string; title: string; note: string | null; userName: string | null; createdAt: string }[] | null>(null);
  const live = effectiveLive(b, now);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await api("PATCH", `/api/admin/breaking/${b.id}`, { version: b.version, ...body });
      toast(msg);
      onChanged();
    } catch (e) {
      onError(e, onChanged);
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    setBusy(true);
    try {
      const res = await api<{ article: { id: string } }>("POST", `/api/admin/breaking/${b.id}/convert`);
      toast("기사 초안을 만들었습니다. 원본 속보는 그대로 유지됩니다.");
      router.push(`/admin/articles/${res.article.id}`);
    } catch (e) {
      onError(e, onChanged);
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory() {
    setMode(mode === "history" ? "none" : "history");
    if (!history) {
      const res = await api<{ revisions: typeof history }>("GET", `/api/admin/breaking/${b.id}`);
      setHistory(res.revisions);
    }
  }

  return (
    <article className={`panel p-3 ${live ? (b.priority === "URGENT" ? "border-alert" : "border-alert/50") : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {live ? <StatusPill tone="red">● 송출 중</StatusPill> : <StatusPill>{BREAKING_STATUS_LABEL[b.status]}</StatusPill>}
        {b.status === "SCHEDULED" && !live && b.startsAt && new Date(b.startsAt).getTime() > now && <StatusPill tone="blue">예약 {fmtDateTime(b.startsAt)}</StatusPill>}
        {b.status === "LIVE" && !live && b.endsAt && <StatusPill>자동 종료됨</StatusPill>}
        {b.priority === "URGENT" && <StatusPill tone="red">긴급</StatusPill>}
        <StatusPill tone={b.verificationStatus === "CONFIRMED" ? "green" : "amber"}>{VERIFICATION_LABEL[b.verificationStatus]}</StatusPill>
        {b.isPinned && <StatusPill tone="blue">📌 고정</StatusPill>}
        {b.showOnOverlay ? <StatusPill>OBS ON</StatusPill> : <StatusPill>OBS OFF</StatusPill>}
        {b.correctedAt && <StatusPill tone="blue">정정됨</StatusPill>}
      </div>
      <div className="mt-1.5 font-bold">{b.title}</div>
      {!compact && b.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{b.body}</p>}
      {!compact && (
        <div className="mt-1 font-mono text-xs text-dim">
          시작 {fmtDateTime(b.startsAt)} · 종료 {fmtDateTime(b.endsAt)}
          {b.incidentTitle ? ` · 사건: ${b.incidentTitle}` : ""}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(b.status === "DRAFT" || (b.status === "SCHEDULED" && !live)) && (
          <button className="btn btn-sm btn-red" disabled={busy} onClick={() => patch({ action: "publish" }, "송출했습니다.")}>
            {b.status === "SCHEDULED" ? "지금 송출" : "송출"}
          </button>
        )}
        {(b.status === "LIVE" || b.status === "SCHEDULED") && (
          <button className="btn btn-sm" disabled={busy} onClick={() => patch({ action: "end" }, "속보를 종료했습니다.")}>
            종료
          </button>
        )}
        {b.status !== "DRAFT" && b.status !== "CANCELLED" && !compact && (
          <button className="btn btn-sm" disabled={busy} onClick={() => setMode(mode === "correct" ? "none" : "correct")}>
            정정
          </button>
        )}
        {b.status !== "CANCELLED" && b.status !== "ENDED" && !compact && (
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => confirm("이 속보를 취소(철회)할까요?") && patch({ action: "cancel", note: "취소" }, "취소했습니다.")}>
            취소
          </button>
        )}
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => patch({ action: "pin", value: !b.isPinned }, b.isPinned ? "고정 해제" : "고정했습니다.")}>
          {b.isPinned ? "고정 해제" : "고정"}
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => patch({ action: "overlay", value: !b.showOnOverlay }, "OBS 노출 설정을 바꿨습니다.")}>
          {b.showOnOverlay ? "OBS 끄기" : "OBS 켜기"}
        </button>
        {!compact &&
          (b.convertedArticleId ? (
            <Link className="btn btn-sm btn-ghost" href={`/admin/articles/${b.convertedArticleId}`}>
              전환된 기사 →
            </Link>
          ) : (
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={convert}>
              기사로 전환
            </button>
          ))}
        {!compact && (
          <button className="btn btn-sm btn-ghost" onClick={loadHistory}>
            이력
          </button>
        )}
      </div>

      {mode === "correct" && (
        <div className="mt-3 flex flex-col gap-2 rounded border border-intel/40 p-3">
          <input className="field" value={corr.title} onChange={(e) => setCorr({ ...corr, title: e.target.value })} maxLength={120} />
          <textarea className="field min-h-16" value={corr.body} onChange={(e) => setCorr({ ...corr, body: e.target.value })} maxLength={1000} />
          <div className="grid gap-2 sm:grid-cols-2">
            <VerificationSelect value={corr.verificationStatus} onChange={(v) => setCorr({ ...corr, verificationStatus: v as Verification })} />
            <input className="field" placeholder="정정 사유 (공개 표시)" value={corr.note} onChange={(e) => setCorr({ ...corr, note: e.target.value })} maxLength={300} />
          </div>
          <button className="btn btn-blue self-start" disabled={busy} onClick={() => patch({ action: "correct", ...corr }, "정정했습니다. 원문은 이력에 보존됩니다.")}>
            정정 송출
          </button>
        </div>
      )}
      {mode === "history" && (
        <ol className="mt-3 flex flex-col gap-1 rounded border border-line p-3 text-xs">
          {!history && <li className="text-muted">불러오는 중…</li>}
          {history?.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-2">
              <span className="font-mono text-dim">{fmtDateTime(h.createdAt)}</span>
              <span className="font-bold">{h.action}</span>
              <span className="text-muted">{h.title}</span>
              {h.note && <span className="text-blue-300">({h.note})</span>}
              <span className="text-dim">{h.userName}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
