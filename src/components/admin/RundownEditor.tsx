"use client";

import { useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/live/client";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { EPISODE_STATUS_LABEL, RUNDOWN_KIND_LABEL, RUNDOWN_STATUS_LABEL } from "@/lib/labels";
import type { Lookups } from "@/server/admin";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { EpisodeFields, type EpisodeFormValue } from "./EpisodeForms";
import { Field, StatusPill, Toggle } from "./forms";
import type { EpisodeFullJson, RundownItemJson } from "./episode-types";

type LookupsJson = Pick<Lookups, "anchors" | "events"> & {
  articles: { id: string; title: string; status: string }[];
  clips: { id: string; title: string; url: string; status: string }[];
};

export function RundownEditor({ initial, lookups }: { initial: EpisodeFullJson; lookups: LookupsJson }) {
  const { api, toast, can } = useAdmin();
  const onError = useApiErrorHandler();
  const { data, refresh } = usePolling<EpisodeFullJson>(`/api/admin/episodes/${initial.episode.id}`, { initial, intervalMs: 4000 });
  const { episode: ep, items, anchors } = data ?? initial;
  const [busy, setBusy] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const canManage = can("episodes.manage");
  const totalSec = items.filter((i) => i.status !== "SKIPPED").reduce((s, i) => s + i.plannedSeconds, 0);

  async function run(fn: () => Promise<unknown>, msg?: string) {
    setBusy(true);
    try {
      await fn();
      if (msg) toast(msg);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const episodeAction = (action: string, extra: Record<string, unknown> = {}, msg?: string) =>
    run(() => api("PATCH", `/api/admin/episodes/${ep.id}`, { action, version: ep.version, ...extra }), msg);

  function move(idx: number, dir: -1 | 1) {
    const order = items.map((i) => i.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    run(() => api("PUT", `/api/admin/episodes/${ep.id}/rundown`, { episodeVersion: ep.version, order }), "순서를 변경했습니다.");
  }

  const cue = (action: string, itemId?: string) =>
    run(() => api("POST", `/api/admin/episodes/${ep.id}/cue`, { action, itemId, expectedCurrentId: ep.currentItemId }));

  return (
    <div className="flex flex-col gap-4">
      {/* 회차 헤더 */}
      <section className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/admin/episodes" className="text-sm text-muted hover:text-ink">
              ← 회차 목록
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill tone={ep.status === "LIVE" ? "red" : ep.status === "READY" ? "blue" : "default"}>{EPISODE_STATUS_LABEL[ep.status]}</StatusPill>
              {ep.number != null && <span className="font-mono text-sm text-dim">제{ep.number}회</span>}
              <h1 className="text-2xl font-black">{ep.title}</h1>
            </div>
            <div className="mt-1 text-sm text-muted">
              예정 {fmtDateTime(ep.scheduledAt)} · 시작 {fmtDateTime(ep.startedAt)} · 종료 {fmtDateTime(ep.endedAt)} · 예상 총 {fmtDuration(totalSec)}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {anchors.map((a) => (
                <span key={a.id} className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: `${a.color ?? "#64748b"}33`, color: a.color ?? undefined }}>
                  🎙 {a.displayName}
                </span>
              ))}
              {anchors.length === 0 && <span className="text-xs text-warn">배정된 진행자가 없습니다.</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/episodes/${ep.id}/prompter`} className="btn" target="_blank">
              프롬프터 ↗
            </Link>
            {canManage && ep.status === "PLANNED" && (
              <button className="btn" disabled={busy} onClick={() => episodeAction("ready", {}, "준비 완료로 변경했습니다.")}>
                준비 완료
              </button>
            )}
            {canManage && (ep.status === "PLANNED" || ep.status === "READY") && (
              <button className="btn btn-red" disabled={busy} onClick={() => confirm("방송을 시작할까요? 사이트에 LIVE 표시가 켜집니다.") && episodeAction("start", { syncLive: true }, "방송을 시작했습니다.")}>
                ● 방송 시작
              </button>
            )}
            {canManage && ep.status === "LIVE" && (
              <EndEpisodeButton disabled={busy} onEnd={(publishArchive) => episodeAction("end", { syncLive: true, publishArchive }, "방송을 종료했습니다.")} />
            )}
            {canManage && ep.status === "ENDED" && (
              <button className="btn" disabled={busy} onClick={() => episodeAction("archive", { isPublic: !ep.isPublic }, ep.isPublic ? "아카이브 비공개" : "아카이브에 공개했습니다.")}>
                {ep.isPublic ? "아카이브 비공개로" : "아카이브 공개"}
              </button>
            )}
            {canManage && (
              <button className="btn btn-ghost" onClick={() => setEditMeta((v) => !v)}>
                회차 정보 수정
              </button>
            )}
          </div>
        </div>
        {editMeta && <EpisodeMetaEditor ep={ep} anchorIds={anchors.map((a) => a.id)} lookups={lookups} onSaved={() => (setEditMeta(false), refresh())} />}
      </section>

      {ep.status === "LIVE" && (
        <section className="panel flex flex-wrap items-center gap-2 border-alert/60 p-3">
          <span className="font-bold text-alert">● ON AIR</span>
          <span className="text-sm">현재: {items.find((i) => i.id === ep.currentItemId)?.title ?? "시작 전"}</span>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-sm" disabled={busy} onClick={() => cue("prev")}>
              ◀ 이전
            </button>
            <button className="btn btn-sm" disabled={busy || !ep.currentItemId} onClick={() => cue("skip")}>
              건너뛰기
            </button>
            <button className="btn btn-sm btn-red" disabled={busy} onClick={() => cue("next")}>
              다음 ▶
            </button>
          </div>
        </section>
      )}

      {/* 큐시트 */}
      <section className="flex flex-col gap-2">
        {items.length === 0 && <div className="panel p-6 text-center text-muted">큐시트가 비어 있습니다. 아래에서 항목을 추가하세요.</div>}
        {items.map((it, idx) => (
          <RundownRow
            key={`${it.id}:${it.version}`}
            it={it}
            idx={idx}
            count={items.length}
            current={ep.currentItemId === it.id}
            anchors={anchors}
            live={ep.status === "LIVE"}
            busy={busy}
            canManage={canManage && ep.status !== "ENDED"}
            onMove={move}
            onCue={() => cue("goto", it.id)}
            episodeVersion={ep.version}
            drafts={drafts}
            setDrafts={setDrafts}
            refresh={refresh}
          />
        ))}
      </section>

      {canManage && ep.status !== "ENDED" && <AddItemForm episodeId={ep.id} episodeVersion={ep.version} anchors={anchors} lookups={lookups} onAdded={refresh} />}
    </div>
  );
}

function EndEpisodeButton({ onEnd, disabled }: { onEnd: (publishArchive: boolean) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [archive, setArchive] = useState(true);
  if (!open)
    return (
      <button className="btn btn-red" disabled={disabled} onClick={() => setOpen(true)}>
        ■ 방송 종료
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-alert p-2">
      <Toggle checked={archive} onChange={setArchive} label="아카이브에 공개" />
      <button className="btn btn-sm btn-red" disabled={disabled} onClick={() => onEnd(archive)}>
        종료 확정
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>
        취소
      </button>
    </div>
  );
}

function EpisodeMetaEditor({ ep, anchorIds, lookups, onSaved }: { ep: EpisodeFullJson["episode"]; anchorIds: string[]; lookups: LookupsJson; onSaved: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [v, setV] = useState<EpisodeFormValue>({ title: ep.title, number: ep.number, scheduledAt: ep.scheduledAt, eventId: ep.eventId, liveUrl: ep.liveUrl, replayUrl: ep.replayUrl, anchorIds });
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <EpisodeFields value={v} onChange={setV} anchors={lookups.anchors} events={lookups.events} />
      <button
        className="btn btn-red self-start"
        onClick={async () => {
          try {
            await api("PATCH", `/api/admin/episodes/${ep.id}`, { action: "update", version: ep.version, ...v });
            toast("회차 정보를 저장했습니다.");
            onSaved();
          } catch (e) {
            onError(e, onSaved);
          }
        }}
      >
        저장
      </button>
    </div>
  );
}

function RundownRow({
  it,
  idx,
  count,
  current,
  anchors,
  live,
  busy,
  canManage,
  onMove,
  onCue,
  episodeVersion,
  drafts,
  setDrafts,
  refresh,
}: {
  it: RundownItemJson;
  idx: number;
  count: number;
  current: boolean;
  anchors: EpisodeFullJson["anchors"];
  live: boolean;
  busy: boolean;
  canManage: boolean;
  onMove: (idx: number, dir: -1 | 1) => void;
  onCue: () => void;
  episodeVersion: number;
  drafts: Record<string, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  refresh: () => void;
}) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string | null>(it.anchorId ?? anchors[0]?.id ?? null);

  async function patchItem(values: Record<string, unknown>, msg: string) {
    try {
      await api("PATCH", `/api/admin/rundown/${it.id}`, { version: it.version, ...values });
      toast(msg);
    } catch (e) {
      onError(e);
    } finally {
      refresh();
    }
  }

  async function remove() {
    if (!confirm(`'${it.title}' 항목을 삭제할까요?`)) return;
    try {
      await api("DELETE", `/api/admin/rundown/${it.id}?episodeVersion=${episodeVersion}`);
      toast("삭제했습니다.");
    } catch (e) {
      onError(e);
    } finally {
      refresh();
    }
  }

  async function saveScript(anchorId: string) {
    const key = `${it.id}:${anchorId}`;
    const existing = it.scripts.find((s) => s.anchorId === anchorId);
    try {
      await api("PUT", `/api/admin/rundown/${it.id}/script`, { anchorId, body: drafts[key] ?? existing?.body ?? "", version: existing?.version ?? null });
      setDrafts((d) => {
        const n = { ...d };
        delete n[key];
        return n;
      });
      toast("대본을 저장했습니다.");
    } catch (e) {
      onError(e); // 충돌 시 작성 중인 초안은 유지된다
    } finally {
      refresh();
    }
  }

  const tone = it.status === "ON_AIR" ? "red" : it.status === "DONE" ? "green" : it.status === "SKIPPED" ? "default" : "amber";
  return (
    <article className={`panel ${current ? "border-alert ring-2 ring-alert/40" : ""} ${it.status === "DONE" || it.status === "SKIPPED" ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <span className="w-7 text-center font-mono text-lg font-black text-dim">{idx + 1}</span>
          {canManage && (
            <div className="flex flex-col">
              <button className="px-1 text-xs text-muted hover:text-ink disabled:opacity-30" disabled={busy || idx === 0} onClick={() => onMove(idx, -1)} aria-label="위로">
                ▲
              </button>
              <button className="px-1 text-xs text-muted hover:text-ink disabled:opacity-30" disabled={busy || idx === count - 1} onClick={() => onMove(idx, 1)} aria-label="아래로">
                ▼
              </button>
            </div>
          )}
          <StatusPill>{RUNDOWN_KIND_LABEL[it.kind]}</StatusPill>
          <StatusPill tone={tone}>{RUNDOWN_STATUS_LABEL[it.status]}</StatusPill>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">{it.title}</div>
          <div className="text-xs text-dim">
            {it.articleTitle && <>기사: {it.articleTitle} </>}
            {it.clipTitle && (
              <>
                클립:{" "}
                <a href={it.clipUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="underline">
                  {it.clipTitle} ↗
                </a>
              </>
            )}
            {it.notes && <> · {it.notes}</>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field w-auto py-1 text-sm"
            value={it.anchorId ?? ""}
            onChange={(e) => patchItem({ anchorId: e.target.value || null }, "진행자를 변경했습니다.")}
            style={it.anchorColor ? { borderColor: it.anchorColor } : undefined}
            aria-label="담당 진행자"
          >
            <option value="">진행자 미정</option>
            {anchors.map((a) => (
              <option key={a.id} value={a.id}>
                🎙 {a.displayName}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="field w-20 py-1 text-sm"
            defaultValue={it.plannedSeconds}
            min={0}
            onBlur={(e) => Number(e.target.value) !== it.plannedSeconds && patchItem({ plannedSeconds: Number(e.target.value) }, "예상 시간을 변경했습니다.")}
            aria-label="예상 진행 시간(초)"
            title="예상 진행 시간(초)"
          />
          <span className="font-mono text-xs text-dim">{fmtDuration(it.plannedSeconds)}</span>
          {live && !current && (
            <button className="btn btn-sm" disabled={busy} onClick={onCue}>
              여기로 큐
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
            대본 {it.scripts.length > 0 ? `(${it.scripts.length})` : ""}
          </button>
          {canManage && (
            <button className="btn btn-sm btn-ghost" onClick={remove} aria-label="삭제">
              ✕
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="border-t border-line p-3">
          {anchors.length === 0 ? (
            <p className="text-sm text-warn">진행자를 먼저 배정하세요.</p>
          ) : (
            <>
              <div className="mb-2 flex gap-1">
                {anchors.map((a) => {
                  const has = it.scripts.some((s) => s.anchorId === a.id && s.body.trim());
                  return (
                    <button key={a.id} onClick={() => setTab(a.id)} className={`btn btn-sm ${tab === a.id ? "border-ink bg-panel2" : ""}`} style={{ color: a.color ?? undefined }}>
                      🎙 {a.displayName} {has ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
              {tab && (
                <ScriptBox
                  key={tab}
                  value={drafts[`${it.id}:${tab}`] ?? it.scripts.find((s) => s.anchorId === tab)?.body ?? ""}
                  dirty={drafts[`${it.id}:${tab}`] !== undefined}
                  onChange={(v) => setDrafts((d) => ({ ...d, [`${it.id}:${tab}`]: v }))}
                  onSave={() => saveScript(tab)}
                  meta={it.scripts.find((s) => s.anchorId === tab)}
                />
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

function ScriptBox({ value, dirty, onChange, onSave, meta }: { value: string; dirty: boolean; onChange: (v: string) => void; onSave: () => void; meta?: { version: number; updatedAt: string } }) {
  return (
    <div className="flex flex-col gap-2">
      <textarea className="field min-h-40 font-medium leading-relaxed" value={value} onChange={(e) => onChange(e.target.value)} maxLength={20000} placeholder="진행자 대본을 입력하세요" />
      <div className="flex items-center gap-2">
        <button className="btn btn-sm btn-blue" onClick={onSave} disabled={!dirty}>
          대본 저장
        </button>
        {dirty && <span className="text-xs text-warn">저장되지 않은 변경</span>}
        {meta && <span className="font-mono text-xs text-dim">v{meta.version} · {fmtDateTime(meta.updatedAt)}</span>}
      </div>
    </div>
  );
}

function AddItemForm({ episodeId, episodeVersion, anchors, lookups, onAdded }: { episodeId: string; episodeVersion: number; anchors: EpisodeFullJson["anchors"]; lookups: LookupsJson; onAdded: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [f, setF] = useState({ kind: "ARTICLE" as RundownItemJson["kind"], title: "", articleId: "", clipId: "", anchorId: anchors[0]?.id ?? "", plannedSeconds: 90, notes: "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function add() {
    try {
      await api("POST", `/api/admin/episodes/${episodeId}/rundown`, {
        episodeVersion,
        kind: f.kind,
        title: f.title,
        articleId: f.kind === "ARTICLE" ? f.articleId : null,
        clipId: f.kind === "CLIP" ? f.clipId : null,
        breakingId: null,
        anchorId: f.anchorId || null,
        plannedSeconds: f.plannedSeconds,
        notes: f.notes,
      });
      toast("큐시트에 추가했습니다.");
      setF((x) => ({ ...x, title: "", articleId: "", clipId: "", notes: "" }));
    } catch (e) {
      onError(e);
    } finally {
      onAdded();
    }
  }

  return (
    <section className="panel p-4">
      <h2 className="mb-3 font-bold">큐시트 항목 추가</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="종류">
          <select className="field" value={f.kind} onChange={(e) => set("kind", e.target.value as RundownItemJson["kind"])}>
            <option value="ARTICLE">기사</option>
            <option value="CLIP">클립</option>
            <option value="SEGMENT">코너 (오프닝·클로징 등)</option>
          </select>
        </Field>
        {f.kind === "ARTICLE" && (
          <Field label="기사" className="md:col-span-2">
            <select
              className="field"
              value={f.articleId}
              onChange={(e) => {
                const a = lookups.articles.find((x) => x.id === e.target.value);
                setF((x) => ({ ...x, articleId: e.target.value, title: x.title || a?.title || "" }));
              }}
            >
              <option value="">기사 선택</option>
              {lookups.articles.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.status}] {a.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {f.kind === "CLIP" && (
          <Field label="클립" className="md:col-span-2">
            <select
              className="field"
              value={f.clipId}
              onChange={(e) => {
                const c = lookups.clips.find((x) => x.id === e.target.value);
                setF((x) => ({ ...x, clipId: e.target.value, title: x.title || c?.title || "" }));
              }}
            >
              <option value="">클립 선택</option>
              {lookups.clips.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.status}] {c.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {f.kind === "SEGMENT" && <div className="md:col-span-2" />}
        <Field label="큐시트 제목" className="md:col-span-2">
          <input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={150} />
        </Field>
        <Field label="예상 시간(초)">
          <input type="number" className="field" min={0} value={f.plannedSeconds} onChange={(e) => set("plannedSeconds", Number(e.target.value))} />
        </Field>
        <Field label="담당 진행자">
          <select className="field" value={f.anchorId} onChange={(e) => set("anchorId", e.target.value)}>
            <option value="">미정</option>
            {anchors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="메모" className="md:col-span-2">
          <input className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} />
        </Field>
      </div>
      <button className="btn btn-red mt-3" disabled={!f.title.trim() || (f.kind === "ARTICLE" && !f.articleId) || (f.kind === "CLIP" && !f.clipId)} onClick={add}>
        추가
      </button>
    </section>
  );
}
