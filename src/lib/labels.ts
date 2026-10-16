export const INCIDENT_TYPES = ["BATTLE", "RAID", "ALLIANCE", "BETRAYAL", "INCIDENT", "OTHER"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  BATTLE: "전투",
  RAID: "레이드",
  ALLIANCE: "동맹",
  BETRAYAL: "배신",
  INCIDENT: "사건",
  OTHER: "기타",
};

export const VERIFICATION = ["UNVERIFIED", "VERIFYING", "CONFIRMED", "DISPUTED", "FALSE"] as const;
export type Verification = (typeof VERIFICATION)[number];
export const VERIFICATION_LABEL: Record<Verification, string> = {
  UNVERIFIED: "미확인",
  VERIFYING: "확인 중",
  CONFIRMED: "확인 완료",
  DISPUTED: "주장 엇갈림",
  FALSE: "사실 아님",
};

export const REPORT_STATUS = ["RECEIVED", "REVIEWING", "APPROVED", "REJECTED", "PUBLISHED"] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  RECEIVED: "접수",
  REVIEWING: "확인 중",
  APPROVED: "승인",
  REJECTED: "반려",
  PUBLISHED: "기사화",
};

export const ARTICLE_STATUS = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUS)[number];
export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  DRAFT: "초안",
  REVIEW: "검토 중",
  PUBLISHED: "발행",
  ARCHIVED: "보관",
};

export const BREAKING_STATUS = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"] as const;
export type BreakingStatus = (typeof BREAKING_STATUS)[number];
export const BREAKING_STATUS_LABEL: Record<BreakingStatus, string> = {
  DRAFT: "작성 중",
  SCHEDULED: "예약",
  LIVE: "송출 중",
  ENDED: "종료",
  CANCELLED: "취소",
};

export const CLIP_STATUS_LABEL = { PENDING: "검토 대기", APPROVED: "승인", REJECTED: "반려" } as const;
export const CLIP_PLATFORM_LABEL = { YOUTUBE: "YouTube", SOOP: "SOOP", CHZZK: "치지직", TWITCH: "Twitch", OTHER: "외부 링크" } as const;

export const EPISODE_STATUS = ["PLANNED", "READY", "LIVE", "ENDED"] as const;
export type EpisodeStatus = (typeof EPISODE_STATUS)[number];
export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  PLANNED: "기획",
  READY: "준비 완료",
  LIVE: "방송 중",
  ENDED: "방송 종료",
};

export const RUNDOWN_KIND_LABEL = { ARTICLE: "기사", CLIP: "클립", BREAKING: "속보", SEGMENT: "코너" } as const;
export const RUNDOWN_STATUS_LABEL = { PENDING: "대기", ON_AIR: "진행 중", DONE: "완료", SKIPPED: "건너뜀" } as const;

export const OVERLAY_KEYS = ["breaking", "ticker", "headline", "lower_third", "war_status", "standby"] as const;
export type OverlayKey = (typeof OVERLAY_KEYS)[number];
export const OVERLAY_LABEL: Record<OverlayKey, string> = {
  breaking: "속보 배너",
  ticker: "하단 티커",
  headline: "헤드라인",
  lower_third: "하단 자막(진행자)",
  war_status: "전쟁 현황판",
  standby: "대기 화면",
};
export const OVERLAY_MODE_LABEL = { AUTO: "자동", MANUAL: "수동", OFF: "끄기" } as const;

export const POLL_STATUS_LABEL = { DRAFT: "준비", OPEN: "진행 중", CLOSED: "종료" } as const;
