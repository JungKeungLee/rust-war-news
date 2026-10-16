const TZ = "Asia/Seoul";

type DateLike = Date | string | null | undefined;

function toDate(v: DateLike): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(v: DateLike): string {
  const d = toDate(v);
  if (!d) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtDate(v: DateLike): string {
  const d = toDate(v);
  if (!d) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function fmtTime(v: DateLike): string {
  const d = toDate(v);
  if (!d) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function fmtRelative(v: DateLike, now = Date.now()): string {
  const d = toDate(v);
  if (!d) return "-";
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 0) return `${fmtDateTime(d)} 예정`;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return fmtDateTime(d);
}

export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** datetime-local 입력값(브라우저 현지 시각)으로 변환 */
export function toLocalInput(v: DateLike): string {
  const d = toDate(v);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 값 → ISO 문자열 (빈 값은 null) */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
