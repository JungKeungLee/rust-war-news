"use client";

import { useState } from "react";
import Link from "next/link";
import type { Settings } from "@/server/settings";
import { useAdmin, useApiErrorHandler } from "./AdminContext";
import { Field, Toggle } from "./forms";

export function SettingsForm({ initial }: { initial: Settings }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
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
        <h2 className="font-bold">메인 방송 · LIVE 표시</h2>
        <p className="text-sm text-muted">방송 URL·상태·오프라인 안내는 방송 설정 메뉴에서 관리합니다. 사이트 상단 LIVE 표시는 방송 상태가 LIVE 일 때 자동으로 켜집니다.</p>
        <Link href="/admin/broadcast" className="btn self-start">
          방송 설정으로 이동
        </Link>
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
