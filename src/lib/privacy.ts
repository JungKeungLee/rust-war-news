/**
 * 개인정보·비밀값 노출 방지 도우미.
 * 감사 로그와 서버 로그에는 원문 대신 이 함수들의 결과만 남긴다.
 */

/** abcdef@example.com → ab****@example.com */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

/**
 * 서버 로그용 오류 요약. Drizzle 쿼리 오류 메시지에는 쿼리 파라미터(비밀번호 해시·이메일 등)가
 * 그대로 포함되므로 원문을 찍지 않고, 오류 종류·DB 오류 코드·SQL 앞부분·스택 위치만 남긴다.
 */
export function safeErrorForLog(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { type: typeof err };
  const e = err as Error & { code?: string; query?: string; cause?: unknown };
  const cause = e.cause as (Error & { code?: string; constraint?: string; table?: string }) | undefined;
  const isQueryError = typeof e.query === "string" || /^Failed query:/.test(e.message);
  const scrub = (s: string) => s.replace(/\/\/[^@\s]*@/g, "//***@").replace(/params:[\s\S]*$/m, "params: [생략]");
  return {
    name: e.name,
    code: e.code ?? cause?.code,
    // 쿼리 오류는 SQL 본문(값 없이 $1 자리표시만 있음) 앞부분만, 그 외는 메시지 정리본
    message: isQueryError ? `쿼리 실패: ${(e.query ?? e.message.replace(/^Failed query:\s*/, "")).split("\n")[0].slice(0, 160)}` : scrub(e.message).slice(0, 300),
    cause: cause ? { name: cause.name, code: cause.code, constraint: cause.constraint, table: cause.table, message: scrub(cause.message ?? "").slice(0, 200) } : undefined,
    // 스택 앞부분은 메시지(= params 줄 포함)를 반복하므로 "at ..." 프레임만 남긴다
    at: e.stack
      ?.split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("at "))
      .slice(0, 3),
  };
}
