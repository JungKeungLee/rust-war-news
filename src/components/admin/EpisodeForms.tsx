"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { DateTimeInput, Field, MultiCheck } from "./forms";

type Anchor = { id: string; displayName: string; color: string | null };

export type EpisodeFormValue = {
  title: string;
  number: number | null;
  scheduledAt: string | null;
  eventId: string | null;
  liveUrl: string | null;
  replayUrl: string | null;
  anchorIds: string[];
};

export function EpisodeFields({ value, onChange, anchors, events }: { value: EpisodeFormValue; onChange: (v: EpisodeFormValue) => void; anchors: Anchor[]; events: { id: string; name: string }[] }) {
  const set = <K extends keyof EpisodeFormValue>(k: K, v: EpisodeFormValue[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="방송 제목" className="sm:col-span-2">
        <input className="field" value={value.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
      </Field>
      <Field label="회차 번호">
        <input className="field" type="number" min={0} value={value.number ?? ""} onChange={(e) => set("number", e.target.value === "" ? null : Number(e.target.value))} />
      </Field>
      <Field label="방송 예정 시각">
        <DateTimeInput value={value.scheduledAt} onChange={(v) => set("scheduledAt", v)} />
      </Field>
      <Field label="대결 / 시즌">
        <select className="field" value={value.eventId ?? ""} onChange={(e) => set("eventId", e.target.value || null)}>
          <option value="">미지정</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="생방송 주소">
        <input className="field" value={value.liveUrl ?? ""} onChange={(e) => set("liveUrl", e.target.value || null)} placeholder="https://" />
      </Field>
      <Field label="다시보기 주소" className="sm:col-span-2">
        <input className="field" value={value.replayUrl ?? ""} onChange={(e) => set("replayUrl", e.target.value || null)} placeholder="https://" />
      </Field>
      <Field label="진행자 (ANCHOR 역할 계정)" className="sm:col-span-2" hint={anchors.length === 0 ? "계정·권한 메뉴에서 진행자 계정에 ANCHOR 역할을 부여하세요." : undefined}>
        <MultiCheck items={anchors} selected={value.anchorIds} onChange={(ids) => set("anchorIds", ids)} render={(a) => a.displayName} />
      </Field>
    </div>
  );
}

export function EpisodeCreateForm({ anchors, events }: { anchors: Anchor[]; events: { id: string; name: string; isActive: boolean }[] }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<EpisodeFormValue>({
    title: "",
    number: null,
    scheduledAt: null,
    eventId: events.find((e) => e.isActive)?.id ?? null,
    liveUrl: null,
    replayUrl: null,
    anchorIds: anchors.map((a) => a.id),
  });

  async function create() {
    setBusy(true);
    try {
      const res = await api<{ episode: { id: string } }>("POST", "/api/admin/episodes", v);
      toast("방송 회차를 만들었습니다.");
      router.push(`/admin/episodes/${res.episode.id}`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-3 self-start p-4">
      <h2 className="font-bold">새 방송 회차</h2>
      <EpisodeFields value={v} onChange={setV} anchors={anchors} events={events} />
      <button className="btn btn-red" disabled={busy || !v.title.trim()} onClick={create}>
        회차 만들기
      </button>
    </section>
  );
}
