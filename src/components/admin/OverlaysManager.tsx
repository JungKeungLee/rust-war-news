"use client";

import { useState } from "react";
import { usePolling } from "@/lib/live/client";
import { OVERLAY_KEYS, OVERLAY_LABEL, OVERLAY_MODE_LABEL, type OverlayKey } from "@/lib/labels";
import type { OverlayState } from "@/lib/live/types";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { DateTimeInput, Field, StatusPill } from "./forms";
import { effectiveLive, type BreakingItem } from "./BreakingManager";

type Config = { key: OverlayKey; mode: "AUTO" | "MANUAL" | "OFF"; payload: Record<string, unknown>; version: number; updatedAt: string };
type Data = { serverTime: string; configs: Config[]; resolved: { key: OverlayKey; state: OverlayState; version: string }[] };

const AUTO_DESC: Record<OverlayKey, string> = {
  breaking: "송출 중인 속보 중 'OBS 노출'이 켜진 최우선 속보를 표시. 속보 종료 시 자동으로 사라짐",
  ticker: "송출 중 속보 + 최신 발행 기사 제목을 흐르는 자막으로 표시",
  headline: "방송 중 회차의 현재 큐시트 항목 제목 표시",
  lower_third: "현재 큐시트 항목의 담당 진행자 이름 표시",
  war_status: "진행 중 대결의 공개 팀 점수·상태 표시",
  standby: "방송 중이 아닐 때 다음 회차 예정 정보 표시",
};

export function OverlaysManager() {
  const { data, refresh } = usePolling<Data>("/api/admin/overlays", { intervalMs: 4000 });
  const { data: breaking } = usePolling<{ items: BreakingItem[]; serverTime: string }>("/api/admin/breaking", { intervalMs: 6000 });
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  if (!data) return <div className="panel h-64 animate-pulse" />;
  const now = breaking ? new Date(breaking.serverTime).getTime() : 0;
  const liveBreaking = (breaking?.items ?? []).filter((b) => effectiveLive(b, now));

  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      {OVERLAY_KEYS.map((key) => {
        const conf = data.configs.find((c) => c.key === key);
        const res = data.resolved.find((r) => r.key === key);
        if (!conf || !res) return null;
        return <OverlayCard key={`${key}:${conf.version}`} conf={conf} state={res.state} origin={origin} liveBreaking={liveBreaking} onChanged={refresh} />;
      })}
    </div>
  );
}

function OverlayCard({ conf, state, origin, liveBreaking, onChanged }: { conf: Config; state: OverlayState; origin: string; liveBreaking: BreakingItem[]; onChanged: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [mode, setMode] = useState(conf.mode);
  const [payload, setPayload] = useState<Record<string, unknown>>(conf.payload ?? {});
  const [preview, setPreview] = useState(false);
  const url = `${origin}/overlay/${conf.key.replace("_", "-")}`;
  const p = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : "");
  const setP = (k: string, v: unknown) => setPayload((x) => ({ ...x, [k]: v }));

  async function save(nextMode = mode) {
    try {
      const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== "" && v !== null && v !== undefined));
      await api("PATCH", `/api/admin/overlays/${conf.key}`, { version: conf.version, mode: nextMode, payload: clean });
      toast(`${OVERLAY_LABEL[conf.key]} 설정을 송출에 반영했습니다.`);
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  }

  return (
    <section className="panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{OVERLAY_LABEL[conf.key]}</h2>
        <StatusPill tone={state.visible ? "red" : "default"}>{state.visible ? "● 화면에 표시 중" : "표시 안 함"}</StatusPill>
        <StatusPill>{OVERLAY_MODE_LABEL[conf.mode]}</StatusPill>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <code className="min-w-0 flex-1 truncate rounded bg-[#0a111d] px-2 py-1.5 text-muted">{url}</code>
        <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(url).then(() => toast("주소를 복사했습니다."))}>
          복사
        </button>
        <button className="btn btn-sm" onClick={() => setPreview((v) => !v)}>
          미리보기
        </button>
      </div>
      <div className="flex gap-1">
        {(["AUTO", "MANUAL", "OFF"] as const).map((m) => (
          <button key={m} className={`btn btn-sm ${mode === m ? "border-alert bg-alert/15" : ""}`} onClick={() => setMode(m)}>
            {OVERLAY_MODE_LABEL[m]}
          </button>
        ))}
      </div>
      {mode === "AUTO" && <p className="text-sm text-muted">{AUTO_DESC[conf.key]}</p>}
      {mode === "MANUAL" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {conf.key === "breaking" && (
            <Field label="송출할 속보" className="sm:col-span-2" hint="종료된 속보는 선택해도 표시되지 않습니다.">
              <select className="field" value={p("breakingId")} onChange={(e) => setP("breakingId", e.target.value || undefined)}>
                <option value="">선택</option>
                {liveBreaking.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.priority === "URGENT" ? "[긴급] " : ""}
                    {b.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {conf.key === "ticker" && (
            <Field label="자막 문구 (줄마다 하나)" className="sm:col-span-2">
              <textarea
                className="field min-h-24"
                value={Array.isArray(payload.items) ? (payload.items as string[]).join("\n") : ""}
                onChange={(e) => setP("items", e.target.value.split("\n").filter((l) => l.trim()).slice(0, 20))}
              />
            </Field>
          )}
          {conf.key === "headline" && (
            <>
              <Field label="라벨">
                <input className="field" value={p("label")} onChange={(e) => setP("label", e.target.value)} maxLength={30} />
              </Field>
              <Field label="제목">
                <input className="field" value={p("title")} onChange={(e) => setP("title", e.target.value)} maxLength={120} />
              </Field>
              <Field label="부제" className="sm:col-span-2">
                <input className="field" value={p("subtitle")} onChange={(e) => setP("subtitle", e.target.value)} maxLength={200} />
              </Field>
            </>
          )}
          {conf.key === "lower_third" && (
            <>
              <Field label="이름">
                <input className="field" value={p("name")} onChange={(e) => setP("name", e.target.value)} maxLength={40} />
              </Field>
              <Field label="직함·설명">
                <input className="field" value={p("role")} onChange={(e) => setP("role", e.target.value)} maxLength={60} />
              </Field>
            </>
          )}
          {conf.key === "war_status" && (
            <Field label="상단 제목" className="sm:col-span-2" hint="팀 점수·상태는 팀 관리에서 수정합니다.">
              <input className="field" value={p("title")} onChange={(e) => setP("title", e.target.value)} maxLength={120} />
            </Field>
          )}
          {conf.key === "standby" && (
            <>
              <Field label="제목">
                <input className="field" value={p("title")} onChange={(e) => setP("title", e.target.value)} maxLength={120} />
              </Field>
              <Field label="방송 시작 시각">
                <DateTimeInput value={p("startsAt") || null} onChange={(v) => setP("startsAt", v ?? undefined)} />
              </Field>
              <Field label="안내 문구" className="sm:col-span-2">
                <input className="field" value={p("message")} onChange={(e) => setP("message", e.target.value)} maxLength={200} />
              </Field>
            </>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn btn-red" onClick={() => save()}>
          송출에 반영
        </button>
        {conf.mode !== "OFF" && (
          <button className="btn" onClick={() => save("OFF")}>
            즉시 끄기
          </button>
        )}
      </div>
      {preview && (
        <div className="relative w-full overflow-hidden rounded border border-line" style={{ aspectRatio: "16 / 9", background: "repeating-conic-gradient(#1a2333 0% 25%, #111827 0% 50%) 50% / 24px 24px" }}>
          <iframe src={`/overlay/${conf.key.replace("_", "-")}`} title="미리보기" className="absolute left-0 top-0 origin-top-left border-0" style={{ width: 1920, height: 1080, transform: "scale(var(--s))" }} ref={(el) => {
            if (el?.parentElement) el.style.setProperty("--s", String(el.parentElement.clientWidth / 1920));
          }} />
        </div>
      )}
    </section>
  );
}
