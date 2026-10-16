"use client";

import { useMemo, useState } from "react";
import { BROADCAST_PLATFORM_LABEL, buildBroadcastEmbed, toPublicBroadcast, type BroadcastSetting } from "@/lib/broadcast";
import { BROADCAST_STATUS, BROADCAST_STATUS_LABEL } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { siteHostFromEnv } from "@/lib/clips/embed";
import { BroadcastPlayer, BroadcastStatusBar } from "@/components/site/BroadcastPlayer";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { Field, ImageInput, Toggle } from "./forms";

export function BroadcastForm({ initial, initialUpdatedAt }: { initial: BroadcastSetting; initialUpdatedAt: string | null }) {
  const { api, toast, upload } = useAdmin();
  const onError = useApiErrorHandler();
  const [f, setF] = useState<BroadcastSetting>(initial);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof BroadcastSetting>(k: K, v: BroadcastSetting[K]) => setF((x) => ({ ...x, [k]: v }));

  const host = siteHostFromEnv();
  const embed = useMemo(() => (f.url ? buildBroadcastEmbed(f.url, host) : null), [f.url, host]);
  const preview = useMemo(() => toPublicBroadcast(f, updatedAt ? new Date(updatedAt) : null, host), [f, updatedAt, host]);

  async function save() {
    setBusy(true);
    try {
      const res = await api<{ broadcast: BroadcastSetting; updatedAt: string }>("PATCH", "/api/admin/broadcast", { ...f, expectedUpdatedAt: updatedAt });
      setF(res.broadcast);
      setUpdatedAt(res.updatedAt);
      toast("방송 설정을 저장했습니다. 메인 페이지에 몇 초 안에 반영됩니다.");
    } catch (e) {
      onError(e, async () => {
        const cur = await api<{ broadcast: BroadcastSetting; updatedAt: string | null }>("GET", "/api/admin/broadcast");
        setF(cur.broadcast);
        setUpdatedAt(cur.updatedAt);
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
      <section className="panel flex flex-col gap-3 p-4">
        <Field label="방송 URL" hint="SOOP 방송국·라이브 주소(예: https://play.sooplive.co.kr/아이디), YouTube, Twitch 주소">
          <input className="field" value={f.url ?? ""} onChange={(e) => set("url", e.target.value || null)} placeholder="https://play.sooplive.co.kr/..." />
        </Field>
        {embed && (
          <p className={`rounded px-3 py-2 text-xs ${embed.embedUrl ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}>
            {BROADCAST_PLATFORM_LABEL[embed.platform]} 감지 ·{" "}
            {embed.embedUrl
              ? embed.platform === "SOOP"
                ? "SOOP 퍼가기 플레이어로 사이트 안에서 재생 (음소거 자동 재생). 재생이 막히면 원본 링크가 함께 표시됩니다."
                : "공식 임베드 플레이어로 사이트 안에서 재생 (음소거 자동 재생)"
              : "사이트 안 재생 불가 — 썸네일과 원본 링크로 표시됩니다"}
          </p>
        )}
        <Field label="방송 제목">
          <input className="field" value={f.title ?? ""} onChange={(e) => set("title", e.target.value || null)} maxLength={100} placeholder="RWN 저녁 뉴스" />
        </Field>
        <Field label="방송 설명">
          <input className="field" value={f.description ?? ""} onChange={(e) => set("description", e.target.value || null)} maxLength={500} />
        </Field>
        <Field label="방송 상태 (수동 설정)" hint="외부 플랫폼의 실제 방송 여부를 자동으로 확인하지 않습니다. 실제 방송을 켜고 끌 때 함께 바꿔주세요. 회차 '방송 시작/종료'를 누르면 LIVE/종료로 자동 변경됩니다.">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {BROADCAST_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={`btn btn-sm ${f.status === s ? (s === "LIVE" ? "btn-red" : "border-ink bg-panel2") : ""}`}
              >
                {s === "LIVE" ? "● LIVE" : BROADCAST_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="썸네일 (임베드 불가·대기 화면 배경)">
          <ImageInput value={f.thumbnailUrl} onChange={(v) => set("thumbnailUrl", v)} upload={upload} />
        </Field>
        <Field label="오프라인 안내 문구" hint="비우면 기본 문구: 현재 뉴스 방송을 준비 중입니다…">
          <textarea className="field min-h-16" value={f.offlineMessage ?? ""} onChange={(e) => set("offlineMessage", e.target.value || null)} maxLength={200} />
        </Field>
        <Toggle checked={f.isPublic} onChange={(v) => set("isPublic", v)} label="메인 페이지에 방송 공개 (끄면 URL을 숨기고 대기 화면만 표시)" />
        <div className="flex items-center gap-3">
          <button className="btn btn-red" disabled={busy} onClick={save}>
            저장
          </button>
          <span className="font-mono text-xs text-dim">마지막 수정 {fmtDateTime(updatedAt)}</span>
        </div>
      </section>
      <section className="panel flex flex-col gap-3 p-4">
        <div className="panel-head">메인 페이지 미리보기 (저장 전 상태 포함)</div>
        <BroadcastStatusBar b={preview} />
        <BroadcastPlayer b={preview} />
      </section>
    </div>
  );
}
