/**
 * 입력 텍스트 정리: 제어문자 제거, HTML 태그 제거, 공백 정리.
 * 화면 출력은 항상 React 이스케이프를 거치며 dangerouslySetInnerHTML 을 사용하지 않는다(이중 방어).
 */
export function cleanText(input: string, opts: { multiline?: boolean } = {}): string {
  let s = input.normalize("NFC");
  // 제어 문자 제거 (줄바꿈/탭은 multiline 일 때 유지)
  s = opts.multiline ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") : s.replace(/[\u0000-\u001F\u007F]/g, " ");
  // 양방향 제어 문자(텍스트 위장) 제거
  s = s.replace(/[‪-‮⁦-⁩]/g, "");
  // HTML 태그·주석 제거
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?[a-zA-Z][^>]*>/g, "");
  if (opts.multiline) {
    s = s.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n");
    return s.trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[::1\]|\[fc|\[fd)/i;

/**
 * 외부 URL 검증: https 만 허용, 사용자 정보·내부망 주소 차단, 길이 제한.
 * 반환값은 정규화된 URL 문자열, 실패 시 null.
 */
export function safeHttpsUrl(input: string | null | undefined, maxLength = 500): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw || raw.length > maxLength) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (BLOCKED_HOSTS.test(url.hostname) || !url.hostname.includes(".")) return null;
  return url.toString();
}
