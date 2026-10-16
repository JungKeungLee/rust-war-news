import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* 공통                                                                 */
/* ------------------------------------------------------------------ */

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();
/** 낙관적 잠금용 버전. 수정 시 WHERE version = ? 로 충돌을 검사한다. */
const version = () => integer("version").notNull().default(1);

/* ------------------------------------------------------------------ */
/* Enum                                                                */
/* ------------------------------------------------------------------ */

export const roleCode = pgEnum("role_code", ["SUPER_ADMIN", "EDITOR", "ANCHOR", "OPERATOR"]);
export const incidentType = pgEnum("incident_type", ["BATTLE", "RAID", "ALLIANCE", "BETRAYAL", "INCIDENT", "OTHER"]);
export const verificationStatus = pgEnum("verification_status", [
  "UNVERIFIED",
  "VERIFYING",
  "CONFIRMED",
  "DISPUTED",
  "FALSE",
]);
export const reportStatus = pgEnum("report_status", ["RECEIVED", "REVIEWING", "APPROVED", "REJECTED", "PUBLISHED"]);
export const articleStatus = pgEnum("article_status", ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);
export const breakingPriority = pgEnum("breaking_priority", ["URGENT", "NORMAL"]);
export const breakingStatus = pgEnum("breaking_status", ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"]);
export const clipPlatform = pgEnum("clip_platform", ["YOUTUBE", "SOOP", "CHZZK", "TWITCH", "OTHER"]);
export const clipStatus = pgEnum("clip_status", ["PENDING", "APPROVED", "REJECTED"]);
export const episodeStatus = pgEnum("episode_status", ["PLANNED", "READY", "LIVE", "ENDED"]);
export const rundownKind = pgEnum("rundown_kind", ["ARTICLE", "CLIP", "BREAKING", "SEGMENT"]);
export const rundownStatus = pgEnum("rundown_status", ["PENDING", "ON_AIR", "DONE", "SKIPPED"]);
export const overlayMode = pgEnum("overlay_mode", ["AUTO", "MANUAL", "OFF"]);
export const pollStatus = pgEnum("poll_status", ["DRAFT", "OPEN", "CLOSED"]);
export const pollResultVisibility = pgEnum("poll_result_visibility", ["ALWAYS", "AFTER_VOTE", "AFTER_CLOSE"]);
export const flagStatus = pgEnum("flag_status", ["OPEN", "RESOLVED", "DISMISSED"]);

/* ------------------------------------------------------------------ */
/* 사용자 · 권한 · 세션                                                 */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    /** 진행자 표시 색상 (프롬프터/큐시트 구분용) */
    color: text("color"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`)],
);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: roleCode("code").notNull().unique(),
  name: text("name").notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_roles_role_idx").on(t.roleId)],
);

/** 세션 ID는 원문 토큰의 SHA-256 해시만 저장한다. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    csrfToken: text("csrf_token").notNull(),
    expiresAt: ts("expires_at").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    ipHash: text("ip_hash").notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_attempts_email_idx").on(t.email, t.createdAt),
    index("login_attempts_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

/** 고정 창(fixed window) 요청 제한 카운터. 서버리스 인스턴스 간 공유를 위해 DB에 둔다. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* 대결(시즌) · 팀 · 선수                                               */
/* ------------------------------------------------------------------ */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    season: text("season"),
    description: text("description"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("events_active_idx").on(t.isActive)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    shortName: text("short_name"),
    color: text("color").notNull().default("#64748b"),
    logoUrl: text("logo_url"),
    description: text("description"),
    /** 전쟁 상황판 공개 상태 문구 (예: 공세, 수세) */
    statusLabel: text("status_label"),
    score: integer("score").notNull().default(0),
    isEliminated: boolean("is_eliminated").notNull().default(false),
    isPublic: boolean("is_public").notNull().default(true),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("teams_event_name_uq").on(t.eventId, t.name), index("teams_event_idx").on(t.eventId)],
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nickname: text("nickname").notNull(),
    profile: text("profile"),
    streamUrl: text("stream_url"),
    avatarUrl: text("avatar_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("players_nickname_uq").on(t.nickname)],
);

/** 시즌별 소속. 팀이 대결(event)에 속하므로 시즌별 소속이 자연스럽게 분리된다. */
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    role: text("role"),
    joinedAt: ts("joined_at"),
    leftAt: ts("left_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("team_members_team_player_uq").on(t.teamId, t.playerId), index("team_members_player_idx").on(t.playerId)],
);

/* ------------------------------------------------------------------ */
/* 미디어                                                               */
/* ------------------------------------------------------------------ */

export const mediaFiles = pgTable(
  "media_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 'db' = data 컬럼 저장. 외부 스토리지 교체 시 'external' + url 사용 */
    storage: text("storage").notNull().default("db"),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    data: bytea("data"),
    url: text("url"),
    /** true면 누구나 열람. 제보 증거는 제보 승인 시에만 공개로 전환된다. */
    isPublic: boolean("is_public").notNull().default(false),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    uploaderIpHash: text("uploader_ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("media_sha_idx").on(t.sha256)],
);

/* ------------------------------------------------------------------ */
/* 사건 (중심 엔티티)                                                   */
/* ------------------------------------------------------------------ */

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    type: incidentType("type").notNull().default("INCIDENT"),
    summary: text("summary"),
    occurredAt: ts("occurred_at"),
    verificationStatus: verificationStatus("verification_status").notNull().default("UNVERIFIED"),
    isPublic: boolean("is_public").notNull().default(false),
    /** 공개 가능 시각. 거점 위치 등 민감 정보는 이 시각 전까지 비공개 */
    publishAt: ts("publish_at"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    isClosed: boolean("is_closed").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("incidents_event_idx").on(t.eventId),
    index("incidents_public_idx").on(t.isPublic, t.publishAt),
    index("incidents_occurred_idx").on(t.occurredAt),
  ],
);

export const incidentTeams = pgTable(
  "incident_teams",
  {
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    side: text("side"),
  },
  (t) => [primaryKey({ columns: [t.incidentId, t.teamId] }), index("incident_teams_team_idx").on(t.teamId)],
);

/* ------------------------------------------------------------------ */
/* 제보                                                                 */
/* ------------------------------------------------------------------ */

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    type: incidentType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    occurredAt: ts("occurred_at"),
    videoUrl: text("video_url"),
    nickname: text("nickname"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    status: reportStatus("status").notNull().default("RECEIVED"),
    /** 관리자 전용 반려 사유. 공개 API로 노출하지 않는다. */
    rejectReason: text("reject_reason"),
    /** 경기상 민감 정보 포함 여부. true면 본문 대신 publicSummary만 공개 */
    isSensitive: boolean("is_sensitive").notNull().default(false),
    publicSummary: text("public_summary"),
    publicAfter: ts("public_after"),
    adminNote: text("admin_note"),
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    submitterIpHash: text("submitter_ip_hash"),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_incident_idx").on(t.incidentId),
    index("reports_ip_idx").on(t.submitterIpHash, t.createdAt),
  ],
);

export const reportTeams = pgTable(
  "report_teams",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.teamId] })],
);

/** 제보 증거 파일 */
export const reportMedia = pgTable(
  "report_media",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaFiles.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.mediaId] }), index("report_media_media_idx").on(t.mediaId)],
);

/* ------------------------------------------------------------------ */
/* 클립                                                                 */
/* ------------------------------------------------------------------ */

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    platform: clipPlatform("platform").notNull().default("OTHER"),
    /** 서버가 검증한 임베드 URL. null이면 외부 링크로만 노출 */
    embedUrl: text("embed_url"),
    thumbnailUrl: text("thumbnail_url"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    submitterNickname: text("submitter_nickname"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    status: clipStatus("status").notNull().default("PENDING"),
    isHot: boolean("is_hot").notNull().default(false),
    rejectReason: text("reject_reason"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    submitterIpHash: text("submitter_ip_hash"),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clips_status_idx").on(t.status, t.createdAt),
    index("clips_hot_idx").on(t.isHot),
    index("clips_incident_idx").on(t.incidentId),
  ],
);

/* ------------------------------------------------------------------ */
/* 속보                                                                 */
/* ------------------------------------------------------------------ */

export const breakingNews = pgTable(
  "breaking_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body"),
    priority: breakingPriority("priority").notNull().default("NORMAL"),
    verificationStatus: verificationStatus("verification_status").notNull().default("UNVERIFIED"),
    status: breakingStatus("status").notNull().default("DRAFT"),
    isPinned: boolean("is_pinned").notNull().default(false),
    showOnOverlay: boolean("show_on_overlay").notNull().default(true),
    /** 노출 시작 시각. 미래면 예약 발행 */
    startsAt: ts("starts_at"),
    /** 노출 종료 시각. 지나면 자동 종료로 간주 */
    endsAt: ts("ends_at"),
    publishedAt: ts("published_at"),
    endedAt: ts("ended_at"),
    correctedAt: ts("corrected_at"),
    correctionNote: text("correction_note"),
    convertedArticleId: uuid("converted_article_id").references((): AnyPgColumn => articles.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("breaking_status_idx").on(t.status, t.startsAt),
    index("breaking_incident_idx").on(t.incidentId),
  ],
);

/** 속보 정정 이력 (발행·정정·취소·종료·기사전환 모두 기록) */
export const breakingRevisions = pgTable(
  "breaking_revisions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    breakingId: uuid("breaking_id")
      .notNull()
      .references(() => breakingNews.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    note: text("note"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("breaking_revisions_breaking_idx").on(t.breakingId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* 기사                                                                 */
/* ------------------------------------------------------------------ */

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    /** 속보에서 전환된 경우 원본 속보 (원본은 그대로 보존) */
    sourceBreakingId: uuid("source_breaking_id").references((): AnyPgColumn => breakingNews.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    lead: text("lead"),
    body: text("body").notNull().default(""),
    status: articleStatus("status").notNull().default("DRAFT"),
    verificationStatus: verificationStatus("verification_status").notNull().default("UNVERIFIED"),
    isFeatured: boolean("is_featured").notNull().default(false),
    coverUrl: text("cover_url"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: ts("published_at"),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("articles_status_idx").on(t.status, t.publishedAt),
    index("articles_incident_idx").on(t.incidentId),
    index("articles_featured_idx").on(t.isFeatured),
  ],
);

/** 기사 수정 이력 */
export const articleRevisions = pgTable(
  "article_revisions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    lead: text("lead"),
    body: text("body").notNull(),
    status: articleStatus("status").notNull(),
    note: text("note"),
    editedBy: uuid("edited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("article_revisions_article_idx").on(t.articleId, t.version)],
);

export const articleClips = pgTable(
  "article_clips",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.clipId] }), index("article_clips_clip_idx").on(t.clipId)],
);

/* ------------------------------------------------------------------ */
/* 방송 회차 · 큐시트 · 대본                                            */
/* ------------------------------------------------------------------ */

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    number: integer("number"),
    title: text("title").notNull(),
    scheduledAt: ts("scheduled_at"),
    status: episodeStatus("status").notNull().default("PLANNED"),
    startedAt: ts("started_at"),
    endedAt: ts("ended_at"),
    liveUrl: text("live_url"),
    replayUrl: text("replay_url"),
    /** 아카이브 공개 여부 */
    isPublic: boolean("is_public").notNull().default(false),
    currentItemId: uuid("current_item_id").references((): AnyPgColumn => rundownItems.id, {
      onDelete: "set null",
    }),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("episodes_status_idx").on(t.status, t.scheduledAt)],
);

/** 뉴스 진행자 배정 */
export const episodeAnchors = pgTable(
  "episode_anchors",
  {
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.userId] })],
);

export const rundownItems = pgTable(
  "rundown_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: rundownKind("kind").notNull().default("SEGMENT"),
    title: text("title").notNull(),
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),
    clipId: uuid("clip_id").references(() => clips.id, { onDelete: "set null" }),
    breakingId: uuid("breaking_id").references(() => breakingNews.id, { onDelete: "set null" }),
    anchorId: uuid("anchor_id").references(() => users.id, { onDelete: "set null" }),
    plannedSeconds: integer("planned_seconds").notNull().default(60),
    status: rundownStatus("status").notNull().default("PENDING"),
    notes: text("notes"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("rundown_episode_idx").on(t.episodeId, t.position)],
);

/** 진행자별 대본 */
export const rundownScripts = pgTable(
  "rundown_scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rundownItemId: uuid("rundown_item_id")
      .notNull()
      .references(() => rundownItems.id, { onDelete: "cascade" }),
    anchorId: uuid("anchor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    version: version(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("rundown_scripts_item_anchor_uq").on(t.rundownItemId, t.anchorId)],
);

/* ------------------------------------------------------------------ */
/* OBS 오버레이 · 사이트 설정                                           */
/* ------------------------------------------------------------------ */

export const overlayStates = pgTable("overlay_states", {
  key: text("key").primaryKey(),
  mode: overlayMode("mode").notNull().default("AUTO"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  version: version(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* 투표                                                                 */
/* ------------------------------------------------------------------ */

export const polls = pgTable(
  "polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    description: text("description"),
    status: pollStatus("status").notNull().default("DRAFT"),
    resultVisibility: pollResultVisibility("result_visibility").notNull().default("AFTER_VOTE"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    closedAt: ts("closed_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("polls_status_idx").on(t.status)],
);

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [uniqueIndex("poll_options_position_uq").on(t.pollId, t.position)],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    /** 익명 투표자 쿠키 ID의 HMAC. 같은 브라우저의 중복 투표를 막는다. */
    voterKey: text("voter_key").notNull(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("poll_votes_voter_uq").on(t.pollId, t.voterKey),
    index("poll_votes_option_idx").on(t.optionId),
    index("poll_votes_ip_idx").on(t.pollId, t.ipHash),
  ],
);

/* ------------------------------------------------------------------ */
/* 사용자 신고 · 감사 로그                                              */
/* ------------------------------------------------------------------ */

export const contentFlags = pgTable(
  "content_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    status: flagStatus("status").notNull().default("OPEN"),
    reporterIpHash: text("reporter_ip_hash"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("content_flags_status_idx").on(t.status, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_user_idx").on(t.userId),
  ],
);
