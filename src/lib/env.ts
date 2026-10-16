/**
 * 서버 환경변수 점검. 값은 절대 반환하지 않고 "무엇이 문제인지"만 알려준다.
 * instrumentation(서버 시작 로그)과 /api/health 가 함께 사용한다.
 */
export type EnvIssue = { name: string; level: "error" | "warn"; message: string };

export function checkServerEnv(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProd = env.NODE_ENV === "production";
  const onVercel = !!env.VERCEL;

  const db = env.DATABASE_URL?.trim();
  if (!db) {
    issues.push({ name: "DATABASE_URL", level: "error", message: "설정되지 않았습니다. Neon 의 Pooled connection 문자열(postgresql://...)을 넣으세요." });
  } else if (db.startsWith("pglite:")) {
    if (onVercel) issues.push({ name: "DATABASE_URL", level: "error", message: "Vercel 에서는 pglite: (로컬 파일 DB)를 쓸 수 없습니다. Neon 연결 문자열을 넣으세요." });
  } else if (!/^postgres(ql)?:\/\//.test(db)) {
    issues.push({ name: "DATABASE_URL", level: "error", message: "postgresql:// 또는 pglite: 형식이어야 합니다." });
  }

  const secret = env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    issues.push({
      name: "AUTH_SECRET",
      level: isProd ? "error" : "warn",
      message: secret ? "32자 이상이어야 합니다." : "설정되지 않았습니다. 32자 이상의 무작위 문자열을 넣으세요.",
    });
  }

  if (!env.NEXT_PUBLIC_SITE_URL) {
    issues.push({ name: "NEXT_PUBLIC_SITE_URL", level: "warn", message: "설정되지 않았습니다. 공개 주소(https://도메인)를 넣으세요. (Twitch 임베드·Origin 검사 보조)" });
  }
  return issues;
}
