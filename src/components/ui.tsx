import Link from "next/link";
import { INCIDENT_TYPE_LABEL, VERIFICATION_LABEL, type IncidentType, type Verification } from "@/lib/labels";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <span className={cx("inline-flex items-center gap-2 whitespace-nowrap font-black tracking-tight", h)}>
      <span className="inline-flex items-center justify-center rounded-sm bg-alert px-1.5 py-0.5 font-mono text-[0.8em] leading-none text-white">RWN</span>
      <span className="leading-none">
        RUST WAR <span className="text-alert">NEWS</span>
      </span>
    </span>
  );
}

const VERIFY_STYLE: Record<Verification, string> = {
  UNVERIFIED: "border-warn/60 text-warn bg-warn/10",
  VERIFYING: "border-intel/60 text-intel bg-intel/10",
  CONFIRMED: "border-ok/60 text-ok bg-ok/10",
  DISPUTED: "border-warn/60 text-warn bg-warn/10",
  FALSE: "border-dim text-muted bg-panel2 line-through",
};

/** 미확인/확인 완료 정보를 시각적으로 구분하는 배지 */
export function VerificationBadge({ status, className }: { status: string; className?: string }) {
  const s = (status in VERIFICATION_LABEL ? status : "UNVERIFIED") as Verification;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.72rem] font-bold", VERIFY_STYLE[s], className)}>
      {s === "CONFIRMED" ? "✓" : s === "FALSE" ? "✕" : "?"} {VERIFICATION_LABEL[s]}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded bg-panel2 px-1.5 py-0.5 font-mono text-[0.72rem] font-bold text-muted ring-1 ring-line">
      {INCIDENT_TYPE_LABEL[type as IncidentType] ?? type}
    </span>
  );
}

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "red" | "amber" | "green" | "blue"; className?: string }) {
  const tones = {
    default: "bg-panel2 text-muted ring-line",
    red: "bg-alert/15 text-red-300 ring-alert/50",
    amber: "bg-warn/10 text-warn ring-warn/40",
    green: "bg-ok/10 text-ok ring-ok/40",
    blue: "bg-intel/10 text-blue-300 ring-intel/40",
  };
  return <span className={cx("inline-flex shrink-0 items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[0.72rem] font-bold ring-1", tones[tone], className)}>{children}</span>;
}

export function SectionTitle({ children, href, more = "더보기", kicker }: { children: React.ReactNode; href?: string; more?: string; kicker?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b border-line pb-2">
      <div>
        {kicker && <div className="panel-head mb-0.5">{kicker}</div>}
        <h2 className="text-lg font-extrabold sm:text-xl">{children}</h2>
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm text-muted hover:text-ink">
          {more} →
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="font-mono text-xs tracking-widest text-dim">NO DATA</div>
      <div className="font-bold">{title}</div>
      {desc && <p className="max-w-md text-sm text-muted">{desc}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "문제가 발생했습니다", desc }: { title?: string; desc?: string }) {
  return (
    <div className="panel border-alert/50 px-4 py-8 text-center">
      <div className="font-mono text-xs tracking-widest text-alert">ERROR</div>
      <div className="mt-1 font-bold">{title}</div>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
    </div>
  );
}

/** 이미지가 없는 콘텐츠용 기본 썸네일 */
export function CoverPlaceholder({ label, color, className }: { label?: string; color?: string | null; className?: string }) {
  return (
    <div
      className={cx("ops-grid relative flex items-center justify-center overflow-hidden bg-panel2", className)}
      style={color ? { boxShadow: `inset 0 -3px 0 ${color}` } : undefined}
    >
      <span className="font-mono text-xs font-bold tracking-[0.3em] text-dim">{label ?? "RWN"}</span>
    </div>
  );
}

export function PageHeader({ kicker, title, desc, actions }: { kicker?: string; title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker && <div className="panel-head mb-1 text-alert">{kicker}</div>}
        <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function TeamChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-panel2 px-1.5 py-0.5 text-xs font-semibold ring-1 ring-line">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

/** 여러 줄 평문을 문단으로 렌더 (HTML 해석 없음) */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </div>
  );
}
