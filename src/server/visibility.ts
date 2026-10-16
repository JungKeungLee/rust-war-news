import "server-only";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { articles, breakingNews, clips, incidents, reports } from "@/db/schema";

/**
 * 공개 노출 규칙을 한 곳에 모은다. 공개 페이지·API·오버레이는 반드시 이 조건을 사용한다.
 */
const now = sql`now()`;

/** 사건: 공개 + 공개 가능 시각 도달 */
export const incidentVisible = and(eq(incidents.isPublic, true), or(isNull(incidents.publishAt), lte(incidents.publishAt, now)));

/** 기사: 발행 상태 + 발행 시각 도달 */
export const articleVisible = and(eq(articles.status, "PUBLISHED"), lte(articles.publishedAt, now));

/** 제보: 승인(또는 기사화) + 공개 시각 도달. 접수·확인 중·반려는 절대 공개하지 않는다. */
export const reportVisible = and(
  inArray(reports.status, ["APPROVED", "PUBLISHED"]),
  or(isNull(reports.publicAfter), lte(reports.publicAfter, now)),
);

/** 클립: 승인된 것만 */
export const clipVisible = eq(clips.status, "APPROVED");

/**
 * 속보: 송출(예약 포함) 상태 + 시작 시각 도달 + 종료 시각 전.
 * 예약 발행·자동 종료는 별도 스케줄러 없이 이 조건으로 처리된다.
 */
export const breakingActive = and(
  inArray(breakingNews.status, ["SCHEDULED", "LIVE"]),
  lte(breakingNews.startsAt, now),
  or(isNull(breakingNews.endsAt), gt(breakingNews.endsAt, now)),
);

/** 지난 속보(공개 기록용): 한 번이라도 송출된 속보 */
export const breakingPublished = and(
  inArray(breakingNews.status, ["SCHEDULED", "LIVE", "ENDED"]),
  lte(breakingNews.startsAt, now),
);
