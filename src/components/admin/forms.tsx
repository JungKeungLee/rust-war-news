"use client";

import { useState } from "react";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import { VERIFICATION, VERIFICATION_LABEL } from "@/lib/labels";

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="lbl">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-dim">{hint}</p>}
    </div>
  );
}

/** ISO 문자열 ↔ datetime-local 변환 입력 */
export function DateTimeInput({ value, onChange, disabled }: { value: string | null; onChange: (iso: string | null) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1">
      <input type="datetime-local" className="field" value={toLocalInput(value)} disabled={disabled} onChange={(e) => onChange(fromLocalInput(e.target.value))} />
      {value && !disabled && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)} aria-label="시각 지우기">
          ✕
        </button>
      )}
    </div>
  );
}

export function VerificationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {VERIFICATION.map((v) => (
        <option key={v} value={v}>
          {VERIFICATION_LABEL[v]}
        </option>
      ))}
    </select>
  );
}

export function IncidentSelect({
  value,
  onChange,
  incidents,
  placeholder = "사건 연결 안 함",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  incidents: { id: string; title: string; verificationStatus: string; isClosed?: boolean }[];
  placeholder?: string;
}) {
  return (
    <select className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {incidents.map((i) => (
        <option key={i.id} value={i.id}>
          {i.isClosed ? "[종결] " : ""}
          {i.title} ({VERIFICATION_LABEL[i.verificationStatus as keyof typeof VERIFICATION_LABEL]})
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="h-4 w-4 accent-alert" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function MultiCheck<T extends { id: string }>({
  items,
  selected,
  onChange,
  render,
}: {
  items: T[];
  selected: string[];
  onChange: (ids: string[]) => void;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <button
            type="button"
            key={it.id}
            onClick={() => onChange(on ? selected.filter((s) => s !== it.id) : [...selected, it.id])}
            className={`rounded border px-2 py-1 text-xs font-semibold ${on ? "border-ink bg-panel2 text-ink" : "border-line text-muted"}`}
          >
            {on ? "✓ " : ""}
            {render(it)}
          </button>
        );
      })}
      {items.length === 0 && <span className="text-xs text-dim">항목 없음</span>}
    </div>
  );
}

/** 이미지 업로드 또는 URL 입력 */
export function ImageInput({ value, onChange, upload }: { value: string | null; onChange: (v: string | null) => void; upload: (f: File) => Promise<{ url: string }> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input className="field" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} placeholder="https:// 또는 업로드" />
        <label className="btn btn-sm shrink-0 cursor-pointer">
          {busy ? "업로드 중" : "업로드"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              setErr(null);
              try {
                onChange((await upload(f)).url);
              } catch (er) {
                setErr(er instanceof Error ? er.message : "업로드 실패");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
      {err && <p className="text-xs text-alert">{err}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value && <img src={value} alt="" referrerPolicy="no-referrer" className="h-20 w-auto self-start rounded border border-line object-cover" />}
    </div>
  );
}

export function StatusPill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "red" | "amber" | "green" | "blue" }) {
  const tones = {
    default: "bg-panel2 text-muted ring-line",
    red: "bg-alert/20 text-red-200 ring-alert/60",
    amber: "bg-warn/10 text-warn ring-warn/40",
    green: "bg-ok/10 text-ok ring-ok/40",
    blue: "bg-intel/10 text-blue-300 ring-intel/40",
  };
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[0.72rem] font-bold ring-1 ${tones[tone]}`}>{children}</span>;
}
