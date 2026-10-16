"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import {
  ARTICLE_STATUS_LABEL,
  BREAKING_STATUS_LABEL,
  CLIP_STATUS_LABEL,
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABEL,
  REPORT_STATUS_LABEL,
  VERIFICATION_LABEL,
  type IncidentType,
  type Verification,
} from "@/lib/labels";
import { useAdmin, useApiErrorHandler, useLoader } from "./AdminContext";
import { DateTimeInput, Field, MultiCheck, StatusPill, Toggle, VerificationSelect } from "./forms";

type Incident = {
  id: string;
  title: string;
  type: IncidentType;
  eventId: string | null;
  summary: string | null;
  occurredAt: string | null;
  verificationStatus: Verification;
  isPublic: boolean;
  publishAt: string | null;
  isSensitive: boolean;
  isClosed: boolean;
  version: number;
  updatedAt: string;
  teams?: { id: string; name: string; color: string }[];
  teamIds?: string[];
};

type Detail = {
  incident: Incident & { teamIds: string[] };
  reports: { id: string; title: string; status: keyof typeof REPORT_STATUS_LABEL; createdAt: string }[];
  breaking: { id: string; title: string; status: keyof typeof BREAKING_STATUS_LABEL; startsAt: string | null }[];
  articles: { id: string; title: string; status: keyof typeof ARTICLE_STATUS_LABEL; publishedAt: string | null }[];
  clips: { id: string; title: string; status: keyof typeof CLIP_STATUS_LABEL }[];
};

const EMPTY = {
  title: "",
  type: "INCIDENT" as IncidentType,
  eventId: null as string | null,
  summary: "",
  occurredAt: null as string | null,
  verificationStatus: "UNVERIFIED" as Verification,
  isPublic: false,
  publishAt: null as string | null,
  isSensitive: false,
  isClosed: false,
  teamIds: [] as string[],
};

export function IncidentsManager({
  teams,
  events,
  initialId,
}: {
  teams: { id: string; name: string; color: string; eventId: string; eventName: string }[];
  events: { id: string; name: string; isActive: boolean }[];
  initialId: string | null;
}) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [list, setList] = useState<Incident[] | null>(null);
  const [selected, setSelected] = useState<string | null>(initialId);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState({ ...EMPTY, eventId: events.find((e) => e.isActive)?.id ?? null });
  const [version, setVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const res = await api<{ incidents: Incident[] }>("GET", "/api/admin/incidents");
    setList(res.incidents);
  }, [api]);

  const loadDetail = useCallback(
    async (id: string) => {
      const res = await api<Detail>("GET", `/api/admin/incidents/${id}`);
      setDetail(res);
      const i = res.incident;
      setForm({
        title: i.title,
        type: i.type,
        eventId: i.eventId,
        summary: i.summary ?? "",
        occurredAt: i.occurredAt,
        verificationStatus: i.verificationStatus,
        isPublic: i.isPublic,
        publishAt: i.publishAt,
        isSensitive: i.isSensitive,
        isClosed: i.isClosed,
        teamIds: i.teamIds,
      });
      setVersion(i.version);
    },
    [api],
  );

  const loadSelected = useCallback(async () => {
    if (selected) await loadDetail(selected);
  }, [selected, loadDetail]);
  useLoader(loadList);
  useLoader(loadSelected);

  function newIncident() {
    setSelected(null);
    setDetail(null);
    setVersion(null);
    setForm({ ...EMPTY, eventId: events.find((e) => e.isActive)?.id ?? null });
  }

  async function save() {
    setBusy(true);
    try {
      if (selected && version) {
        await api("PATCH", `/api/admin/incidents/${selected}`, { ...form, version });
        toast("사건을 저장했습니다.");
        await loadDetail(selected);
      } else {
        const res = await api<{ incident: Incident }>("POST", "/api/admin/incidents", form);
        toast("사건을 만들었습니다.");
        setSelected(res.incident.id);
      }
      await loadList();
    } catch (e) {
      onError(e, () => selected && loadDetail(selected));
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const eventTeams = teams.filter((t) => !form.eventId || t.eventId === form.eventId);
  const publicNow = form.isPublic && (!form.publishAt || new Date(form.publishAt) <= new Date());

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <section className="panel flex max-h-[80vh] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-3">
          <span className="font-bold">사건 목록</span>
          <button className="btn btn-sm btn-red" onClick={newIncident}>
            + 새 사건
          </button>
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {list === null && <li className="p-4 text-sm text-muted">불러오는 중…</li>}
          {list?.length === 0 && <li className="p-4 text-sm text-muted">사건이 없습니다.</li>}
          {list?.map((i) => (
            <li key={i.id}>
              <button onClick={() => setSelected(i.id)} className={`w-full p-3 text-left hover:bg-panel2 ${selected === i.id ? "bg-panel2" : ""}`}>
                <div className="flex flex-wrap items-center gap-1">
                  <StatusPill>{INCIDENT_TYPE_LABEL[i.type]}</StatusPill>
                  <StatusPill tone={i.verificationStatus === "CONFIRMED" ? "green" : "amber"}>{VERIFICATION_LABEL[i.verificationStatus]}</StatusPill>
                  {i.isPublic ? <StatusPill tone="blue">공개</StatusPill> : <StatusPill>비공개</StatusPill>}
                  {i.isClosed && <StatusPill>종결</StatusPill>}
                </div>
                <div className="mt-1 font-semibold">{i.title}</div>
                <div className="font-mono text-xs text-dim">{fmtDateTime(i.occurredAt ?? i.updatedAt)}</div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{selected ? "사건 편집" : "새 사건"}</h2>
            {selected && (
              <span className={`text-xs font-bold ${publicNow ? "text-ok" : "text-warn"}`}>{publicNow ? "● 현재 공개 중" : "● 공개 화면에 표시되지 않음"}</span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="사건명" className="md:col-span-2">
              <input className="field" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={150} />
            </Field>
            <Field label="사건 유형">
              <select className="field" value={form.type} onChange={(e) => set("type", e.target.value as IncidentType)}>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {INCIDENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="대결 / 시즌">
              <select className="field" value={form.eventId ?? ""} onChange={(e) => set("eventId", e.target.value || null)}>
                <option value="">미지정</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.isActive ? " (진행 중)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="사건 발생 시각">
              <DateTimeInput value={form.occurredAt} onChange={(v) => set("occurredAt", v)} />
            </Field>
            <Field label="사실 확인 상태">
              <VerificationSelect value={form.verificationStatus} onChange={(v) => set("verificationStatus", v as Verification)} />
            </Field>
            <Field label="요약" className="md:col-span-2" hint="공개 시 상황판에 표시됩니다. 거점 좌표 등 민감 정보는 적지 마세요.">
              <textarea className="field min-h-20" value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={3000} />
            </Field>
            <Field label="관련 팀" className="md:col-span-2">
              <MultiCheck items={eventTeams} selected={form.teamIds} onChange={(ids) => set("teamIds", ids)} render={(t) => t.name} />
            </Field>
            <Field label="공개 가능 시각" hint="비워두면 공개 체크 즉시 노출">
              <DateTimeInput value={form.publishAt} onChange={(v) => set("publishAt", v)} />
            </Field>
            <div className="flex flex-col justify-end gap-2">
              <Toggle checked={form.isPublic} onChange={(v) => set("isPublic", v)} label="공개" />
              <Toggle checked={form.isSensitive} onChange={(v) => set("isSensitive", v)} label="경기상 민감 정보 포함" />
              <Toggle checked={form.isClosed} onChange={(v) => set("isClosed", v)} label="종결 (진행 중 목록에서 제외)" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-red" disabled={busy || !form.title.trim()} onClick={save}>
              {selected ? "저장" : "사건 만들기"}
            </button>
            {selected && (
              <>
                <Link className="btn" href={`/admin/breaking?incident=${selected}`}>
                  이 사건으로 속보 작성
                </Link>
                <Link className="btn" href={`/admin/articles/new?incident=${selected}`}>
                  이 사건으로 기사 작성
                </Link>
              </>
            )}
          </div>
        </div>

        {detail && (
          <div className="grid gap-4 md:grid-cols-2">
            <Linked title={`연결된 제보 (${detail.reports.length})`} href="/admin/reports">
              {detail.reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.title}</span>
                  <StatusPill>{REPORT_STATUS_LABEL[r.status]}</StatusPill>
                </li>
              ))}
            </Linked>
            <Linked title={`속보 (${detail.breaking.length})`} href="/admin/breaking">
              {detail.breaking.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{b.title}</span>
                  <StatusPill tone={b.status === "LIVE" ? "red" : "default"}>{BREAKING_STATUS_LABEL[b.status]}</StatusPill>
                </li>
              ))}
            </Linked>
            <Linked title={`정규 기사 (${detail.articles.length})`} href="/admin/articles">
              {detail.articles.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/articles/${a.id}`} className="truncate hover:underline">
                    {a.title}
                  </Link>
                  <StatusPill tone={a.status === "PUBLISHED" ? "green" : "default"}>{ARTICLE_STATUS_LABEL[a.status]}</StatusPill>
                </li>
              ))}
            </Linked>
            <Linked title={`클립 (${detail.clips.length})`} href="/admin/clips">
              {detail.clips.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.title}</span>
                  <StatusPill>{CLIP_STATUS_LABEL[c.status]}</StatusPill>
                </li>
              ))}
            </Linked>
          </div>
        )}
      </section>
    </div>
  );
}

function Linked({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-head">{title}</span>
        <Link href={href} className="text-xs text-muted hover:text-ink">
          관리 →
        </Link>
      </div>
      {arr.length === 0 ? <p className="text-sm text-dim">없음</p> : <ul className="flex flex-col gap-1.5 text-sm">{children}</ul>}
    </div>
  );
}
