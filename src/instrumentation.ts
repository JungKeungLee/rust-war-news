/** 서버 시작 시 1회: 필수 환경변수 누락을 로그로 즉시 알린다 (요청마다 원인을 추적하지 않아도 되도록). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkServerEnv } = await import("./lib/env");
  for (const issue of checkServerEnv()) {
    const line = `[env] ${issue.name}: ${issue.message}`;
    if (issue.level === "error") console.error(line);
    else console.warn(line);
  }
}
