"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { INCIDENT_TYPES, INCIDENT_TYPE_LABEL } from "@/lib/labels";
import { fromLocalInput } from "@/lib/format";

const MAX_FILES = 3;
const MAX_MB = 3;

export function ReportForm({ teams }: { teams: { id: string; name: string; color: string }[] }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message?: string; receipt?: string }>({ status: "idle" });
  const [anonymous, setAnonymous] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  function checkFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > MAX_FILES) {
      setFileError(`이미지는 최대 ${MAX_FILES}장까지 첨부할 수 있습니다.`);
      e.target.value = "";
      return;
    }
    const big = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) {
      setFileError(`${big.name}: ${MAX_MB}MB 이하 이미지만 첨부할 수 있습니다.`);
      e.target.value = "";
      return;
    }
    setFileError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "sending" });
    const fd = new FormData(e.currentTarget);
    fd.set("occurredAt", fromLocalInput(String(fd.get("occurredAtLocal") ?? "")) ?? "");
    fd.delete("occurredAtLocal");
    fd.set("elapsedMs", String(Date.now() - startedAt.current));
    try {
      const res = await fetch("/api/reports", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "제보 접수에 실패했습니다.");
      setState({ status: "done", receipt: json.receipt });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "오류가 발생했습니다." });
    }
  }

  if (state.status === "done") {
    return (
      <div className="panel border-ok/50 p-6 text-center">
        <div className="font-mono text-xs tracking-widest text-ok">REPORT RECEIVED</div>
        <h2 className="mt-2 text-xl font-black">제보가 접수되었습니다</h2>
        <p className="mt-2 text-sm text-muted">
          접수번호 <span className="font-mono font-bold text-ink">{state.receipt}</span>
          <br />
          운영진이 사실 확인 후 승인한 경우에만 공개됩니다.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/" className="btn">
            홈으로
          </Link>
          <button className="btn btn-red" onClick={() => location.reload()}>
            추가 제보
          </button>
        </div>
      </div>
    );
  }

  const sending = state.status === "sending";
  return (
    <form onSubmit={onSubmit} className="panel flex flex-col gap-5 p-4 sm:p-6" encType="multipart/form-data">
      {/* 봇 차단용 숨김 필드 */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          웹사이트
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="lbl">제보 유형 *</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {INCIDENT_TYPES.map((t, i) => (
            <label key={t} className="cursor-pointer">
              <input type="radio" name="type" value={t} defaultChecked={i === 0} className="peer sr-only" required />
              <span className="block rounded border border-line bg-[#0a111d] py-2.5 text-center text-sm font-bold peer-checked:border-alert peer-checked:bg-alert/15 peer-focus-visible:ring-2 peer-focus-visible:ring-intel">
                {INCIDENT_TYPE_LABEL[t]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="lbl" htmlFor="title">
          제목 *
        </label>
        <input id="title" name="title" className="field" required minLength={4} maxLength={120} placeholder="예) 북쪽 해안 기지 대규모 레이드 발생" />
      </div>

      <div>
        <label className="lbl" htmlFor="body">
          상세 설명 *
        </label>
        <textarea id="body" name="body" className="field min-h-36" required minLength={10} maxLength={4000} placeholder="언제, 누가, 무엇을 했는지 알려주세요. 정확한 좌표 등 민감한 작전 정보는 운영진만 확인하며 승인 전에는 공개되지 않습니다." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl" htmlFor="occurredAtLocal">
            사건 발생 시각
          </label>
          <input id="occurredAtLocal" name="occurredAtLocal" type="datetime-local" className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="videoUrl">
            외부 영상 URL
          </label>
          <input id="videoUrl" name="videoUrl" type="url" inputMode="url" className="field" maxLength={500} placeholder="https://" />
        </div>
      </div>

      {teams.length > 0 && (
        <fieldset>
          <legend className="lbl">관련 팀</legend>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input type="checkbox" name="teamIds" value={t.id} className="peer sr-only" />
                <span className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm font-semibold peer-checked:border-ink peer-checked:bg-panel2 peer-focus-visible:ring-2 peer-focus-visible:ring-intel">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label className="lbl" htmlFor="images">
          이미지 (최대 {MAX_FILES}장, 장당 {MAX_MB}MB, JPG·PNG·WEBP·GIF)
        </label>
        <input id="images" name="images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={checkFiles} className="field file:mr-3 file:rounded file:border-0 file:bg-panel2 file:px-3 file:py-1 file:text-ink" />
        {fileError && <p className="mt-1 text-sm text-alert">{fileError}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="lbl" htmlFor="nickname">
            닉네임
          </label>
          <input id="nickname" name="nickname" className="field" maxLength={30} disabled={anonymous} placeholder={anonymous ? "익명 제보" : "공개 시 표시될 닉네임"} />
        </div>
        <label className="flex items-center gap-2 self-end rounded border border-line px-3 py-3 text-sm font-semibold">
          <input type="checkbox" name="isAnonymous" value="1" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 accent-alert" />
          익명으로 제보 (공개 화면에 닉네임 미표시)
        </label>
      </div>

      {state.status === "error" && <p className="rounded border border-alert/50 bg-alert/10 px-3 py-2 text-sm text-red-300">{state.message}</p>}

      <button type="submit" className="btn btn-red py-3 text-base" disabled={sending || !!fileError}>
        {sending ? "전송 중…" : "제보 보내기"}
      </button>
      <p className="text-xs text-dim">허위 제보, 개인정보, 타인을 비방하는 내용은 반려됩니다. 제보 내용은 운영 목적으로만 사용됩니다.</p>
    </form>
  );
}
