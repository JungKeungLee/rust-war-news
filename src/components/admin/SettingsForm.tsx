"use client";

import { useState } from "react";
import type { Settings } from "@/server/settings";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { Field, Toggle } from "./forms";

export function SettingsForm({ initial }: { initial: Settings }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [live, setLive] = useState(initial.live);
  const [notice, setNotice] = useState(initial.notice.text ?? "");
  const [intake, setIntake] = useState(initial.intake);

  async function save(key: string, value: unknown) {
    try {
      await api("PATCH", "/api/admin/settings", { key, value });
      toast("설정을 저장했습니다.");
    } catch (e) {
      onError(e);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="font-bold">LIVE 방송 표시</h2>
        <Toggle checked={live.isLive} onChange={(v) => setLive({ ...live, isLive: v })} label="사이트에 LIVE 표시" />
        <Field label="방송 링크">
          <input className="field" value={live.url ?? ""} onChange={(e) => setLive({ ...live, url: e.target.value || null })} placeholder="https://" />
        </Field>
        <Field label="방송 제목">
          <input className="field" value={live.title ?? ""} onChange={(e) => setLive({ ...live, title: e.target.value || null })} maxLength={80} />
        </Field>
        <button className="btn btn-red self-start" onClick={() => save("live", live)}>
          저장
        </button>
      </section>
      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="font-bold">상단 공지</h2>
        <Field label="공지 문구 (비우면 숨김)">
          <input className="field" value={notice} onChange={(e) => setNotice(e.target.value)} maxLength={200} />
        </Field>
        <button className="btn btn-red self-start" onClick={() => save("notice", { text: notice || null })}>
          저장
        </button>
      </section>
      <section className="panel flex flex-col gap-3 p-4">
        <h2 className="font-bold">접수</h2>
        <Toggle checked={intake.reportsOpen} onChange={(v) => setIntake({ ...intake, reportsOpen: v })} label="제보 접수 열기" />
        <Toggle checked={intake.clipsOpen} onChange={(v) => setIntake({ ...intake, clipsOpen: v })} label="클립 접수 열기" />
        <button className="btn btn-red self-start" onClick={() => save("intake", intake)}>
          저장
        </button>
      </section>
    </div>
  );
}
