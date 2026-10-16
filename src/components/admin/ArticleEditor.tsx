"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { ARTICLE_STATUS, ARTICLE_STATUS_LABEL, CLIP_STATUS_LABEL, type ArticleStatus, type Verification } from "@/lib/labels";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { Field, ImageInput, IncidentSelect, Toggle, VerificationSelect } from "./forms";

type Initial = {
  id: string | null;
  version: number | null;
  title: string;
  lead: string;
  body: string;
  status: ArticleStatus;
  verificationStatus: string;
  isFeatured: boolean;
  coverUrl: string | null;
  incidentId: string | null;
  clipIds: string[];
  sourceBreakingId: string | null;
};

export function ArticleEditor({
  initial,
  incidents,
  clips,
  revisions,
}: {
  initial: Initial;
  incidents: { id: string; title: string; verificationStatus: string; isClosed: boolean }[];
  clips: { id: string; title: string; url: string; status: keyof typeof CLIP_STATUS_LABEL }[];
  revisions: { version: number; title: string; status: ArticleStatus; note: string | null; createdAt: string; editor: string | null }[];
}) {
  const { api, toast, upload } = useAdmin();
  const onError = useApiErrorHandler();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [clipQuery, setClipQuery] = useState("");
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(status?: ArticleStatus) {
    setBusy(true);
    const payload = {
      title: f.title,
      lead: f.lead,
      body: f.body,
      status: status ?? f.status,
      verificationStatus: f.verificationStatus,
      isFeatured: f.isFeatured,
      coverUrl: f.coverUrl,
      incidentId: f.incidentId,
    };
    try {
      if (f.id) {
        await api("PATCH", `/api/admin/articles/${f.id}`, { ...payload, version: f.version, note: note || undefined, clipIds: f.clipIds });
        toast(status === "PUBLISHED" ? "기사를 발행했습니다." : "저장했습니다.");
        setNote("");
        router.refresh();
      } else {
        const res = await api<{ article: { id: string; version: number } }>("POST", "/api/admin/articles", payload);
        if (f.clipIds.length) {
          await api("PATCH", `/api/admin/articles/${res.article.id}`, { ...payload, version: res.article.version, clipIds: f.clipIds, note: "클립 연결" });
        }
        toast("기사를 만들었습니다.");
        router.push(`/admin/articles/${res.article.id}`);
      }
    } catch (e) {
      onError(e, () => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const clipMatches = clips.filter((c) => !f.clipIds.includes(c.id) && c.title.toLowerCase().includes(clipQuery.toLowerCase())).slice(0, 8);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="panel flex flex-col gap-3 p-4">
        {f.sourceBreakingId && <p className="rounded bg-intel/10 px-3 py-2 text-sm text-blue-300">속보에서 전환된 기사입니다. 원본 속보와 그 이력은 그대로 보존됩니다.</p>}
        <Field label="제목">
          <input className="field text-lg font-bold" value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={150} />
        </Field>
        <Field label="리드 (요약)">
          <textarea className="field min-h-16" value={f.lead} onChange={(e) => set("lead", e.target.value)} maxLength={400} />
        </Field>
        <Field label="본문" hint="빈 줄로 문단을 나눕니다. HTML은 사용할 수 없습니다.">
          <textarea className="field min-h-[22rem] leading-relaxed" value={f.body} onChange={(e) => set("body", e.target.value)} maxLength={30000} />
        </Field>
        <Field label="커버 이미지">
          <ImageInput value={f.coverUrl} onChange={(v) => set("coverUrl", v)} upload={upload} />
        </Field>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="panel flex flex-col gap-3 p-4">
          <Field label="상태">
            <select className="field" value={f.status} onChange={(e) => set("status", e.target.value as ArticleStatus)}>
              {ARTICLE_STATUS.map((s) => (
                <option key={s} value={s}>
                  {ARTICLE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="사실 확인 상태">
            <VerificationSelect value={f.verificationStatus} onChange={(v) => set("verificationStatus", v as Verification)} />
          </Field>
          <Field label="관련 사건">
            <IncidentSelect value={f.incidentId} onChange={(v) => set("incidentId", v)} incidents={incidents} />
          </Field>
          <Toggle checked={f.isFeatured} onChange={(v) => set("isFeatured", v)} label="메인 주요 뉴스" />
          {f.id && <input className="field text-sm" placeholder="수정 메모 (이력에 기록)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />}
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={busy || !f.title.trim()} onClick={() => save()}>
              저장
            </button>
            {f.status !== "PUBLISHED" && (
              <button className="btn btn-red" disabled={busy || !f.title.trim() || !f.body.trim()} onClick={() => save("PUBLISHED")}>
                발행
              </button>
            )}
            {f.id && initial.status === "PUBLISHED" && (
              <Link className="btn btn-ghost" href={`/news/${f.id}`} target="_blank">
                공개 화면 ↗
              </Link>
            )}
          </div>
          {f.version && <p className="font-mono text-xs text-dim">현재 버전 v{f.version}</p>}
        </div>

        <div className="panel flex flex-col gap-2 p-4">
          <div className="panel-head">연결 클립</div>
          {f.clipIds.length === 0 && <p className="text-sm text-dim">연결된 클립이 없습니다.</p>}
          <ul className="flex flex-col gap-1">
            {f.clipIds.map((id) => {
              const c = clips.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {c?.title ?? id} {c && c.status !== "APPROVED" && <span className="text-warn">({CLIP_STATUS_LABEL[c.status]} — 승인 전 비공개)</span>}
                  </span>
                  <button className="btn btn-sm btn-ghost" onClick={() => set("clipIds", f.clipIds.filter((x) => x !== id))}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <input className="field text-sm" placeholder="클립 검색해서 추가" value={clipQuery} onChange={(e) => setClipQuery(e.target.value)} />
          {clipQuery && (
            <ul className="flex flex-col gap-1">
              {clipMatches.map((c) => (
                <li key={c.id}>
                  <button className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-panel2" onClick={() => (set("clipIds", [...f.clipIds, c.id]), setClipQuery(""))}>
                    + {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {f.id && <p className="text-xs text-dim">클립 변경은 저장 시 반영됩니다.</p>}
        </div>

        {revisions.length > 0 && (
          <div className="panel p-4">
            <div className="panel-head mb-2">수정 이력</div>
            <ol className="flex flex-col gap-1.5 text-xs">
              {revisions.map((r, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="font-mono text-dim">v{r.version}</span>
                  <span className="text-muted">{fmtDateTime(r.createdAt)}</span>
                  <span>{r.editor ?? "-"}</span>
                  <span className="text-dim">{ARTICLE_STATUS_LABEL[r.status]}</span>
                  {r.note && <span className="text-blue-300">{r.note}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}
