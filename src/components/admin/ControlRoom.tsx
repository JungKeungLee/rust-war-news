"use client";

import { useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/live/client";
import { fmtDuration, fmtRelative, fmtTime } from "@/lib/format";
import {
  ARTICLE_STATUS_LABEL,
  EPISODE_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  OVERLAY_LABEL,
  OVERLAY_MODE_LABEL,
  REPORT_STATUS_LABEL,
  RUNDOWN_STATUS_LABEL,
  VERIFICATION_LABEL,
  type ArticleStatus,
  type IncidentType,
  type OverlayKey,
  type ReportStatus,
  type Verification,
} from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { BreakingRow, type BreakingItem } from "./BreakingManager";
import { IncidentSelect, StatusPill } from "./forms";
import type { EpisodeFullJson } from "./episode-types";

type Snapshot = {
  serverTime: string;
  stats: { reportsReceived: number; reportsReviewing: number; reportsTotal: number; openIncidents: number; liveBreaking: number; openFlags: number };
  pendingReports: { id: string; title: string; type: IncidentType; status: ReportStatus; createdAt: string; incidentId: string | null; version: number; isSensitive: boolean }[];
  openIncidents: { id: string; title: string; type: IncidentType; verificationStatus: Verification; isPublic: boolean; updatedAt: string }[];
  liveBreaking: BreakingItem[];
  latestArticles: { id: string; title: string; status: ArticleStatus; updatedAt: string }[];
  overlays: { key: OverlayKey; mode: "AUTO" | "MANUAL" | "OFF"; version: number; updatedAt: string }[];
  hotClips: { id: string; title: string; url: string; embedUrl: string | null; isHot: boolean }[];
  episode: EpisodeFullJson | null;
};

/**
 * 방송 지통실 — 관리자 여러 명이 동시에 보더라도 모든 변경은 서버의 버전 검사/행 잠금을 거친다.
 * 충돌하면 409 안내 후 최신 상태로 다시 그린다. 4초마다 자동 갱신.
 */
export function ControlRoom({ initial }: { initial: Snapshot }) {
  const { data, refresh, error, lastOk } = usePolling<Snapshot>("/api/admin/control-room", { initial, intervalMs: 4000, pauseHidden: false });
  const s = data ?? initial;
  const now = new Date(s.serverTime).getTime();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black">방송 지통실</h1>
        <span className={`font-mono text-xs ${error ? "text-alert" : "text-dim"}`}>
          {error ? `연결 오류: ${error}` : `동기화 ${lastOk ? fmtTime(new Date(lastOk)) : "-"} · 4초 주기`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="접수 제보" value={s.stats.reportsReceived} tone={s.stats.reportsReceived ? "text-warn" : undefined} href="/admin/reports" />
        <Stat label="검증 대기" value={s.stats.reportsReceived + s.stats.reportsReviewing} href="/admin/reports" />
        <Stat label="진행 중 사건" value={s.stats.openIncidents} href="/admin/incidents" />
        <Stat label="송출 중 속보" value={s.stats.liveBreaking} tone={s.stats.liveBreaking ? "text-alert" : undefined} href="/admin/breaking" />
        <Stat label="누적 제보" value={s.stats.reportsTotal} />
        <Stat label="미처리 신고" value={s.stats.openFlags} href="/admin" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <EpisodePanel ep={s.episode} onChanged={refresh} />
        <div className="flex flex-col gap-4">
          <BreakingPanel items={s.liveBreaking} incidents={s.openIncidents} now={now} onChanged={refresh} />
          <OverlayPanel overlays={s.overlays} onChanged={refresh} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ReportsPanel reports={s.pendingReports} incidents={s.openIncidents} onChanged={refresh} />
        <Panel title="진행 중인 사건" href="/admin/incidents">
          {s.openIncidents.length === 0 && <Empty />}
          {s.openIncidents.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/incidents?id=${i.id}`} className="block rounded p-1.5 hover:bg-panel2">
                <div className="flex flex-wrap gap-1">
                  <StatusPill>{INCIDENT_TYPE_LABEL[i.type]}</StatusPill>
                  <StatusPill tone={i.verificationStatus === "CONFIRMED" ? "green" : "amber"}>{VERIFICATION_LABEL[i.verificationStatus]}</StatusPill>
                  {i.isPublic ? <StatusPill tone="blue">공개</StatusPill> : <StatusPill>비공개</StatusPill>}
                </div>
                <div className="mt-0.5 text-sm font-semibold">{i.title}</div>
              </Link>
            </li>
          ))}
        </Panel>
        <Panel title="최신 뉴스" href="/admin/articles">
          {s.latestArticles.length === 0 && <Empty />}
          {s.latestArticles.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 p-1.5 text-sm">
              <Link href={`/admin/articles/${a.id}`} className="truncate hover:underline">
                {a.title}
              </Link>
              <StatusPill tone={a.status === "PUBLISHED" ? "green" : "default"}>{ARTICLE_STATUS_LABEL[a.status]}</StatusPill>
            </li>
          ))}
        </Panel>
        <Panel title="핫 클립" href="/admin/clips">
          {s.hotClips.length === 0 && <Empty />}
          {s.hotClips.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 p-1.5 text-sm">
              <span className="truncate">
                {c.isHot && <span className="mr-1 text-alert">HOT</span>}
                {c.title}
              </span>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm shrink-0">
                열기 ↗
              </a>
            </li>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone?: string; href?: string }) {
  const body = (
    <>
      <div className="panel-head">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-black ${tone ?? ""}`}>{value}</div>
    </>
  );
  return href ? (
    <Link href={href} className="panel p-3 hover:border-[#3a4a68]">
      {body}
    </Link>
  ) : (
    <div className="panel p-3">{body}</div>
  );
}

function Panel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-head">{title}</span>
        {href && (
          <Link href={href} className="text-xs text-muted hover:text-ink">
            관리 →
          </Link>
        )}
      </div>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}

const Empty = () => <li className="p-2 text-sm text-dim">없음</li>;

function ReportsPanel({ reports, incidents, onChanged }: { reports: Snapshot["pendingReports"]; incidents: Snapshot["openIncidents"]; onChanged: () => void }) {
  const { api, toast, can } = useAdmin();
  const onError = useApiErrorHandler();
  const allowed = can("reports.review");

  async function patch(r: Snapshot["pendingReports"][number], body: Record<string, unknown>, msg: string) {
    try {
      await api("PATCH", `/api/admin/reports/${r.id}`, { version: r.version, ...body });
      toast(msg);
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  }

  return (
    <Panel title="검증 대기 제보" href="/admin/reports">
      {reports.length === 0 && <Empty />}
      {reports.map((r) => (
        <li key={`${r.id}:${r.version}`} className="rounded border border-line p-2">
          <div className="flex flex-wrap items-center gap-1">
            <StatusPill tone={r.status === "RECEIVED" ? "amber" : "blue"}>{REPORT_STATUS_LABEL[r.status]}</StatusPill>
            <StatusPill>{INCIDENT_TYPE_LABEL[r.type]}</StatusPill>
            <span className="font-mono text-xs text-dim">{fmtRelative(r.createdAt)}</span>
          </div>
          <div className="mt-1 text-sm font-semibold">{r.title}</div>
          {allowed && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {r.status === "RECEIVED" && (
                <button className="btn btn-sm self-start" onClick={() => patch(r, { action: "review" }, "확인 중으로 변경")}>
                  제보 확인
                </button>
              )}
              <IncidentSelect value={r.incidentId} onChange={(v) => patch(r, { action: "update", incidentId: v }, "사건에 연결했습니다.")} incidents={incidents.map((i) => ({ ...i, isClosed: false }))} placeholder="사건 연결…" />
            </div>
          )}
        </li>
      ))}
    </Panel>
  );
}

function BreakingPanel({ items, incidents, now, onChanged }: { items: BreakingItem[]; incidents: Snapshot["openIncidents"]; now: number; onChanged: () => void }) {
  const { api, toast, can } = useAdmin();
  const onError = useApiErrorHandler();
  const [title, setTitle] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const allowed = can("breaking.manage");

  async function send() {
    try {
      const inc = incidents.find((i) => i.id === incidentId);
      await api("POST", "/api/admin/breaking", {
        title,
        body: null,
        priority: urgent ? "URGENT" : "NORMAL",
        verificationStatus: inc?.verificationStatus ?? "UNVERIFIED",
        incidentId,
        isPinned: false,
        showOnOverlay: true,
        startsAt: null,
        endsAt: null,
        publish: "now",
      });
      toast("속보를 송출했습니다.");
      setTitle("");
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  }

  return (
    <section className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-head">현재 송출 중인 속보</span>
        <Link href="/admin/breaking" className="text-xs text-muted hover:text-ink">
          속보 관리 →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {items.length === 0 && <p className="p-2 text-sm text-dim">송출 중인 속보 없음</p>}
        {items.map((b) => (
          <BreakingRow key={`${b.id}:${b.version}`} b={b} now={now} onChanged={onChanged} compact />
        ))}
      </div>
      {allowed && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <input className="field" placeholder="빠른 속보 제목" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <IncidentSelect value={incidentId} onChange={setIncidentId} incidents={incidents.map((i) => ({ ...i, isClosed: false }))} />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-alert" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> 긴급
            </label>
            <button className="btn btn-red btn-sm ml-auto" disabled={!title.trim()} onClick={send}>
              즉시 송출
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function OverlayPanel({ overlays, onChanged }: { overlays: Snapshot["overlays"]; onChanged: () => void }) {
  const { api, toast, can } = useAdmin();
  const onError = useApiErrorHandler();
  const allowed = can("overlays.manage");

  async function setMode(o: Snapshot["overlays"][number], mode: "AUTO" | "OFF") {
    try {
      const cur = await api<{ configs: { key: string; payload: Record<string, unknown>; version: number }[] }>("GET", "/api/admin/overlays");
      const conf = cur.configs.find((c) => c.key === o.key);
      await api("PATCH", `/api/admin/overlays/${o.key}`, { version: o.version, mode, payload: conf?.payload ?? {} });
      toast(`${OVERLAY_LABEL[o.key]}: ${OVERLAY_MODE_LABEL[mode]}`);
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  }

  return (
    <section className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="panel-head">OBS 송출 상태</span>
        <Link href="/admin/overlays" className="text-xs text-muted hover:text-ink">
          OBS 관리 →
        </Link>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {overlays.map((o) => (
          <li key={o.key} className="flex items-center justify-between gap-2 rounded border border-line px-2 py-1.5 text-sm">
            <span>{OVERLAY_LABEL[o.key]}</span>
            <span className="flex items-center gap-1">
              <StatusPill tone={o.mode === "OFF" ? "default" : o.mode === "MANUAL" ? "blue" : "green"}>{OVERLAY_MODE_LABEL[o.mode]}</StatusPill>
              {allowed && (
                <button className="btn btn-sm" onClick={() => setMode(o, o.mode === "OFF" ? "AUTO" : "OFF")}>
                  {o.mode === "OFF" ? "켜기" : "끄기"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EpisodePanel({ ep: data, onChanged }: { ep: EpisodeFullJson | null; onChanged: () => void }) {
  const { api, toast, can } = useAdmin();
  const onError = useApiErrorHandler();
  const [showScript, setShowScript] = useState(true);
  if (!data) {
    return (
      <section className="panel p-4">
        <span className="panel-head">방송 큐시트</span>
        <p className="mt-3 text-sm text-muted">예정된 방송 회차가 없습니다.</p>
        <Link href="/admin/episodes" className="btn btn-sm mt-2">
          회차 만들기
        </Link>
      </section>
    );
  }
  const { episode: ep, items, anchors } = data;
  const idx = items.findIndex((i) => i.id === ep.currentItemId);
  const current = idx >= 0 ? items[idx] : null;
  const next = items.slice(idx + 1).find((i) => i.status === "PENDING");

  async function call(fn: () => Promise<unknown>, msg?: string) {
    try {
      await fn();
      if (msg) toast(msg);
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  }

  const cue = (action: string, itemId?: string) => call(() => api("POST", `/api/admin/episodes/${ep.id}/cue`, { action, itemId, expectedCurrentId: ep.currentItemId }));
  const patchItem = (it: (typeof items)[number], values: Record<string, unknown>, msg: string) => call(() => api("PATCH", `/api/admin/rundown/${it.id}`, { version: it.version, ...values }), msg);

  return (
    <section className={`panel flex flex-col gap-3 p-4 ${ep.status === "LIVE" ? "border-alert/60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="panel-head">방송 큐시트</span>
        <StatusPill tone={ep.status === "LIVE" ? "red" : "blue"}>{EPISODE_STATUS_LABEL[ep.status]}</StatusPill>
        <Link href={`/admin/episodes/${ep.id}`} className="font-bold hover:underline">
          {ep.title}
        </Link>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Link href={`/admin/episodes/${ep.id}/prompter`} target="_blank" className="btn btn-sm">
            프롬프터 ↗
          </Link>
          {can("episodes.manage") && ep.status !== "LIVE" && (
            <button className="btn btn-sm btn-red" onClick={() => confirm("방송을 시작할까요?") && call(() => api("PATCH", `/api/admin/episodes/${ep.id}`, { action: "start", version: ep.version, syncLive: true }), "방송 시작")}>
              ● 방송 시작
            </button>
          )}
          {can("episodes.manage") && ep.status === "LIVE" && (
            <button
              className="btn btn-sm btn-red"
              onClick={() =>
                confirm("방송을 종료하고 아카이브에 공개할까요?") &&
                call(() => api("PATCH", `/api/admin/episodes/${ep.id}`, { action: "end", version: ep.version, syncLive: true, publishArchive: true }), "방송을 종료했습니다.")
              }
            >
              ■ 방송 종료
            </button>
          )}
        </div>
      </div>

      {ep.status === "LIVE" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-alert/60 bg-alert/10 p-3">
            <div className="panel-head text-alert">NOW</div>
            <div className="mt-1 text-lg font-black">{current?.title ?? "시작 전 — '다음'을 눌러 첫 항목 진행"}</div>
            {current?.anchorName && <div className="text-sm" style={{ color: current.anchorColor ?? undefined }}>🎙 {current.anchorName}</div>}
          </div>
          <div className="rounded border border-line p-3">
            <div className="panel-head">NEXT · 다음 진행 기사</div>
            <div className="mt-1 font-bold">{next?.title ?? "마지막 항목"}</div>
            {next?.anchorName && <div className="text-sm text-muted">🎙 {next.anchorName}</div>}
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn btn-sm" onClick={() => cue("prev")}>
              ◀ 이전
            </button>
            <button className="btn btn-sm" disabled={!current} onClick={() => cue("skip")}>
              건너뛰기
            </button>
            <button className="btn btn-red flex-1" onClick={() => cue("next")}>
              다음 진행 ▶
            </button>
          </div>
        </div>
      )}

      {current && current.scripts.length > 0 && (
        <div className="rounded border border-line p-3">
          <button className="panel-head mb-1" onClick={() => setShowScript((v) => !v)}>
            현재 대본 {showScript ? "▾" : "▸"}
          </button>
          {showScript &&
            current.scripts.map((sc) => {
              const a = anchors.find((x) => x.id === sc.anchorId);
              return (
                <div key={sc.id} className="mb-2">
                  <div className="text-xs font-bold" style={{ color: a?.color ?? undefined }}>
                    {a?.displayName}
                  </div>
                  <p className="whitespace-pre-line text-sm">{sc.body}</p>
                </div>
              );
            })}
        </div>
      )}

      <ol className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
        {items.map((it, i) => (
          <li key={`${it.id}:${it.version}`} className={`flex flex-wrap items-center gap-2 rounded px-2 py-1.5 text-sm ${it.id === ep.currentItemId ? "bg-alert/15 ring-1 ring-alert/60" : "hover:bg-panel2"}`}>
            <span className="w-5 font-mono text-dim">{i + 1}</span>
            <StatusPill tone={it.status === "ON_AIR" ? "red" : it.status === "DONE" ? "green" : "default"}>{RUNDOWN_STATUS_LABEL[it.status]}</StatusPill>
            <span className={`min-w-0 flex-1 truncate ${it.status === "DONE" || it.status === "SKIPPED" ? "text-dim line-through" : "font-semibold"}`}>{it.title}</span>
            <span className="font-mono text-xs text-dim">{fmtDuration(it.plannedSeconds)}</span>
            {it.clipUrl && (
              <a href={it.clipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 underline">
                클립 ↗
              </a>
            )}
            {can("rundown.operate") && (
              <select className="field w-auto py-0.5 text-xs" value={it.anchorId ?? ""} onChange={(e) => patchItem(it, { anchorId: e.target.value || null }, "진행자 전환")} aria-label="진행자 전환">
                <option value="">진행자</option>
                {anchors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            )}
            {ep.status === "LIVE" && it.id !== ep.currentItemId && (
              <button className="btn btn-sm" onClick={() => cue("goto", it.id)}>
                큐
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-dim">큐시트가 비어 있습니다.</li>}
      </ol>
    </section>
  );
}
