import "server-only";
import { createHmac } from "node:crypto";

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET 은 32자 이상이어야 합니다.");
    return "insecure-development-secret-do-not-use-in-production";
  }
  return s;
}

export function hmac(value: string, purpose: string): string {
  return createHmac("sha256", authSecret()).update(`${purpose}:${value}`).digest("base64url");
}

/** Vercel 등 프록시 뒤에서의 클라이언트 IP. 위조 가능성이 있으므로 식별 보조 수단으로만 쓴다. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** 개인정보 보호를 위해 IP 원문 대신 HMAC 해시만 저장한다. */
export function ipHash(headers: Headers): string {
  return hmac(clientIp(headers), "ip").slice(0, 32);
}

/**
 * 상태 변경 요청의 출처 검사 (CSRF 1차 방어).
 * 브라우저 요청이면 Origin 이 같은 호스트(또는 NEXT_PUBLIC_SITE_URL)여야 한다.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (!origin) {
    // Origin 헤더가 없는 브라우저 요청은 Sec-Fetch-Site 로 판정, 둘 다 없으면 비브라우저 클라이언트
    return !site || site === "same-origin" || site === "none";
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && originHost === host) return true;
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      if (new URL(configured).host === originHost) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}
