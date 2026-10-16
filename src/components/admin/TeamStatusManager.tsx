"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { TEAM_STATUS, TEAM_STATUS_LABEL, VERIFICATION_LABEL, type TeamStatus, type Verification } from "@/lib/labels";
import { TeamStatusBadge } from "@/components/site/live-ui";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { Field, StatusPill, Toggle } from "./forms";

type TeamItem = {
  id: string;
  name: string;
  color: string;
  isPublic: boolean;
  eventName: string;
  eventActive: boolean;
  version: number;
  status: TeamStatus;
  message: string | null;
  statusIsPublic: boolean;
  incidentId: string | null;
  updatedAt: string | null;
  updaterName: string | null;
  teamIncidentIds: string[];
};
type Incident = { id: string; title: string; isPublic: boolean; verificationStatus: Verification };

export function TeamStatusManager({ teams, incidents }: { teams: TeamItem[]; incidents: Incident[] }) {
  if (!teams.length) return <div className="panel p-8 text-center text-muted">등록된 팀이 없습니다. 팀·선수 메뉴에서 팀을 먼저 등록하세요.</div>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {teams.map((t) => (
        <TeamStatusCard key={`${t.id}:${t.version}`} t={t} incidents={incidents} />
      ))}
    </div>
  );
}

function TeamStatusCard({ t, incidents }: { t: TeamItem; incidents: Incident[] }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const router = useRouter();
  const [status, setStatus] = useState<TeamStatus>(t.status);
  const [message, setMessage] = useState(t.message ?? "");
  const [isPublic, setIsPublic] = useState(t.statusIsPublic);
  const [incidentId, setIncidentId] = useState<string | null>(t.incidentId);
  const [busy, setBusy] = useState(false);
  const linked = incidents.filter((i) => t.teamIncidentIds.includes(i.id));
  const others = incidents.filter((i) => !t.teamIncidentIds.includes(i.id));
  const linkedIncident = incidents.find((i) => i.id === incidentId);

  async function save() {
    setBusy(true);
    try {
      await api("PATCH", `/api/admin/teams/${t.id}/status`, { version: t.version, status, message, isPublic, incidentId });
      toast(`${t.name} 상태를 저장했습니다.${isPublic ? " 공개 지통실에 곧 반영됩니다." : " (비공개)"}`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <article className="panel overflow-hidden">
      <div className="h-1.5" style={{ background: t.color }} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold">{t.name}</span>
          <StatusPill>{t.eventName}</StatusPill>
          {!t.isPublic && <StatusPill tone="red">팀 비공개 — 지통실 미노출</StatusPill>}
          <span className="ml-auto text-xs text-dim">
            현재 공개 화면: {t.statusIsPublic ? <TeamStatusBadge status={t.status} /> : <TeamStatusBadge status="UNKNOWN" />}
          </span>
        </div>
        <Field label="현재 상태">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {TEAM_STATUS.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`btn btn-sm ${status === s ? (s === "ALERT" ? "btn-red" : "border-ink bg-panel2") : ""}`}>
                {TEAM_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="상태 설명 (공개 시 그대로 노출)" hint="거점 위치·작전 계획 등 경기에 영향을 주는 미확인 정보는 적지 마세요.">
          <textarea className="field min-h-16" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} />
        </Field>
        <Field label="관련 사건" hint={linkedIncident && !linkedIncident.isPublic ? "선택한 사건은 아직 비공개라 공개 화면에는 연결이 표시되지 않습니다." : undefined}>
          <select className="field" value={incidentId ?? ""} onChange={(e) => setIncidentId(e.target.value || null)}>
            <option value="">연결 안 함</option>
            {linked.length > 0 && (
              <optgroup label="이 팀 사건">
                {linked.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.isPublic ? "" : "[비공개] "}
                    {i.title} ({VERIFICATION_LABEL[i.verificationStatus]})
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="기타 사건">
              {others.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.isPublic ? "" : "[비공개] "}
                  {i.title}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={isPublic} onChange={setIsPublic} label="공개 지통실에 상태 공개" />
          <button className="btn btn-red btn-sm ml-auto" disabled={busy} onClick={save}>
            저장
          </button>
        </div>
        <p className="font-mono text-xs text-dim">
          최종 업데이트 {fmtDateTime(t.updatedAt)}
          {t.updaterName ? ` · ${t.updaterName}` : ""}
        </p>
      </div>
    </article>
  );
}
