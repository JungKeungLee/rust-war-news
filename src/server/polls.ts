import "server-only";
import { randomUUID } from "node:crypto";
import { hmac } from "@/lib/security/request";

/**
 * 투표 참여 정책 (익명 식별)
 *  - 첫 투표 시 HttpOnly 쿠키 rwn_vid(무작위 ID, 1년)를 발급하고, DB에는 그 HMAC 만 저장한다.
 *  - (poll_id, voter_key) 유니크 제약으로 같은 브라우저의 중복 투표를 막는다.
 *  - 보조 수단으로 IP 해시당 투표 수 상한과 요청 횟수 제한을 둔다(공용 IP 고려해 여유 있게).
 *  - 쿠키 삭제·다른 기기 사용으로 재투표가 가능하므로, 결과는 "시청자 참여 지표"로만 안내한다.
 */
export const VOTER_COOKIE = "rwn_vid";
export const MAX_VOTES_PER_IP_PER_POLL = 30;

export function voterKeyFrom(cookieValue: string | undefined | null): string | null {
  if (!cookieValue || !/^[0-9a-f-]{36}$/i.test(cookieValue)) return null;
  return hmac(cookieValue, "voter");
}

export function newVoterId() {
  return randomUUID();
}

export function isPollOpen(p: { status: string; startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  return p.status === "OPEN" && (!p.startsAt || p.startsAt <= now) && (!p.endsAt || p.endsAt > now);
}

export function canSeeResults(p: { status: string; resultVisibility: string; endsAt: Date | null }, voted: boolean, now = new Date()) {
  const closed = p.status === "CLOSED" || (!!p.endsAt && p.endsAt <= now);
  if (p.resultVisibility === "ALWAYS") return true;
  if (p.resultVisibility === "AFTER_VOTE") return voted || closed;
  return closed;
}
