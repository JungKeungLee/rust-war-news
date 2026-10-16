"use client";

import { useEffect, useRef, useState } from "react";
import { usePolling } from "@/lib/live/client";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { INCIDENT_TYPE_LABEL, REPORT_STATUS_LABEL, type IncidentType, type ReportStatus } from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { DateTimeInput, Field, IncidentSelect, StatusPill, Toggle } from "./forms";

type Report = {
  id: string;
  type: string;
  title: string;
  body: string;
  occurredAt: string | null;
  videoUrl: string | null;
  nickname: string | null;
  isAnonymous: boolean;
  status: ReportStatus;
  rejectReason: string | null;
  isSensitive: boolean;
  publicSummary: string | null;
  publicAfter: string | null;
  adminNote: string | null;
  incidentId: string | null;
  incidentTitle: string | null;
  reviewedAt: string | null;
  version: number;
  createdAt: string;
  images: string[];
  teams: { id: string; name: string; color: string }[];
};

const TABS: { key: string; label: string; status: string }[] = [
  { key: "pending", label: "대기 (접수·확인 중)", status: "RECEIVED,REVIEWING" },
  { key: "approved", label: "승인", status: "APPROVED" },
  { key: "published", label: "기사화", status: "PUBLISHED" },
  { key: "rejected", label: "반려", status: "REJECTED" },
  { key: "all", label: "전체", status: "" },
];

const STATUS_TONE: Record<ReportStatus, "amber" | "blue" | "green" | "red" | "default"> = {
  RECEIVED: "amber",
  REVIEWING: "blue",
  APPROVED: "green",
  REJECTED: "red",
  PUBLISHED: "default",
};

type Incident = { id: string; title: string; verificationStatus: string; isClosed: boolean };

export function ReportsManager({ incidents: initialIncidents, events }: { incidents: Incident[]; events: { id: string; name: string; isActive: boolean }[] }) {
  const [tab, setTab] = useState(TABS[0]);
  const [q, setQ] = useState("");
  const [incidents, setIncidents] = useState(initialIncidents);
  const { data, refresh, error } = usePolling<{ reports: Report[] }>(`/api/admin/reports?status=${tab.status}&q=${encodeURIComponent(q)}`, { intervalMs: 5000 });
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // 새로 도착한 제보 강조 (처음 로드된 목록은 기준으로만 사용)
  useEffect(() => {
    if (!data) return;
    const ids = data.reports.map((r) => r.id);
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const newOnes = ids.filter((id) => !seen.current!.has(id));
    if (newOnes.length) {
      newOnes.forEach((id) => seen.current!.add(id));
      setFresh((f) => new Set([...f, ...newOnes]));
      if (typeof document !== "undefined") document.title = `(${newOnes.length}) 새 제보 | RWN 관리자`;
    }
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t)} className={`btn btn-sm ${tab.key === t.key ? "border-alert bg-alert/15" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input className="field sm:max-w-xs" placeholder="제목·내용 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="text-sm text-warn">목록 갱신 실패: {error}</p>}
      {!data ? (
        <div className="panel h-40 animate-pulse" />
      ) : data.reports.length === 0 ? (
        <div className="panel p-8 text-center text-muted">해당하는 제보가 없습니다.</div>
      ) : (
        data.reports.map((r) => (
          <ReportCard
            key={`${r.id}:${r.version}`}
            report={r}
            isNew={fresh.has(r.id)}
            incidents={incidents}
            events={events}
            onChanged={refresh}
            onIncidentCreated={(inc) => setIncidents((list) => [inc, ...list])}
            onSeen={() => setFresh((f) => (f.has(r.id) ? new Set([...f].filter((x) => x !== r.id)) : f))}
          />
        ))
      )}
    </div>
  );
}

function ReportCard({
  report: r,
  isNew,
  incidents,
  events,
  onChanged,
  onIncidentCreated,
  onSeen,
}: {
  report: Report;
  isNew: boolean;
  incidents: Incident[];
  events: { id: string; name: string; isActive: boolean }[];
  onChanged: () => void;
  onIncidentCreated: (i: Incident) => void;
  onSeen: () => void;
}) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [busy, setBusy] = useState(false);
  const [incidentId, setIncidentId] = useState(r.incidentId);
  const [isSensitive, setSensitive] = useState(r.isSensitive);
  const [publicSummary, setSummary] = useState(r.publicSummary ?? "");
  const [publicAfter, setPublicAfter] = useState(r.publicAfter);
  const [adminNote, setNote] = useState(r.adminNote ?? "");
  const [rejectReason, setRejectReason] = useState(r.rejectReason ?? "");
  const [showReject, setShowReject] = useState(false);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    onSeen();
    try {
      await api("PATCH", `/api/admin/reports/${r.id}`, {
        version: r.version,
        action,
        incidentId,
        isSensitive,
        publicSummary,
        publicAfter,
        adminNote,
        ...extra,
      });
      toast(action === "approve" ? "승인했습니다." : action === "reject" ? "반려했습니다." : "저장했습니다.");
      onChanged();
    } catch (e) {
      onError(e, onChanged);
    } finally {
      setBusy(false);
    }
  }

  async function createIncident() {
    setBusy(true);
    try {
      const active = events.find((e) => e.isActive);
      const res = await api<{ incident: Incident }>("POST", `/api/admin/reports/${r.id}/incident`, { version: r.version, eventId: active?.id ?? null });
      onIncidentCreated({ ...res.incident, isClosed: false });
      toast("새 사건을 만들고 연결했습니다. 사건 관리에서 확인 상태와 공개 여부를 설정하세요.");
      onChanged();
    } catch (e) {
      onError(e, onChanged);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`panel p-4 ${isNew ? "border-alert ring-2 ring-alert/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {isNew && <StatusPill tone="red">NEW</StatusPill>}
        <StatusPill tone={STATUS_TONE[r.status]}>{REPORT_STATUS_LABEL[r.status]}</StatusPill>
        <StatusPill>{INCIDENT_TYPE_LABEL[r.type as IncidentType]}</StatusPill>
        {r.isSensitive && <StatusPill tone="amber">민감</StatusPill>}
        <span className="font-mono text-xs text-dim">
          접수 {fmtRelative(r.createdAt)} · #{r.id.slice(0, 8).toUpperCase()}
        </span>
      </div>
      <h3 className="mt-2 text-lg font-bold">{r.title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.body}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <span>발생 {fmtDateTime(r.occurredAt)}</span>
        <span>제보자 {r.isAnonymous ? "익명" : (r.nickname ?? "-")}</span>
        {r.teams.length > 0 && <span>관련 팀 {r.teams.map((t) => t.name).join(", ")}</span>}
        {r.videoUrl && (
          <a href={r.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-300 underline">
            영상 링크 ↗
          </a>
        )}
      </div>
      {r.images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.images.map((src) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="증거 이미지" className="h-24 w-24 rounded border border-line object-cover" />
            </a>
          ))}
        </div>
      )}
      {r.status === "REJECTED" && r.rejectReason && <p className="mt-2 rounded bg-alert/10 px-2 py-1 text-sm text-red-300">반려 사유: {r.rejectReason}</p>}

      <div className="mt-4 grid gap-3 border-t border-line pt-3 md:grid-cols-2">
        <Field label="사건 연결">
          <div className="flex gap-2">
            <IncidentSelect value={incidentId} onChange={setIncidentId} incidents={incidents} />
            <button className="btn btn-sm shrink-0" disabled={busy} onClick={createIncident} title="이 제보로 새 사건 생성">
              + 새 사건
            </button>
          </div>
        </Field>
        <Field label="공개 가능 시각" hint="비워두면 승인 즉시 공개. 작전 정보 보호용 지연 공개">
          <DateTimeInput value={publicAfter} onChange={setPublicAfter} />
        </Field>
        <div className="flex flex-col gap-2">
          <Toggle checked={isSensitive} onChange={setSensitive} label="민감 정보 포함 (본문·이미지 비공개, 요약만 공개)" />
          {isSensitive && <textarea className="field min-h-16 text-sm" placeholder="공개용 요약 (승인 시 필수)" value={publicSummary} onChange={(e) => setSummary(e.target.value)} maxLength={1000} />}
        </div>
        <Field label="관리자 메모 (비공개)">
          <textarea className="field min-h-16 text-sm" value={adminNote} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </div>

      {showReject && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className="field" placeholder="반려 사유 (관리자 기록용, 공개되지 않음)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} />
          <button className="btn btn-red shrink-0" disabled={busy || !rejectReason.trim()} onClick={() => act("reject", { rejectReason })}>
            반려 확정
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {r.status === "RECEIVED" && (
          <button className="btn btn-sm" disabled={busy} onClick={() => act("review")}>
            확인 중으로
          </button>
        )}
        {r.status !== "APPROVED" && r.status !== "PUBLISHED" && (
          <button className="btn btn-sm btn-blue" disabled={busy} onClick={() => act("approve")}>
            승인
          </button>
        )}
        {r.status !== "REJECTED" && (
          <button className="btn btn-sm" disabled={busy} onClick={() => setShowReject((v) => !v)}>
            반려…
          </button>
        )}
        {(r.status === "REJECTED" || r.status === "APPROVED") && (
          <button className="btn btn-sm" disabled={busy} onClick={() => act("reopen")}>
            재검토
          </button>
        )}
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => act("update")}>
          변경 저장
        </button>
        {incidentId && (
          <a className="btn btn-sm btn-ghost" href={`/admin/breaking?incident=${incidentId}`}>
            이 사건으로 속보 →
          </a>
        )}
      </div>
    </article>
  );
}
