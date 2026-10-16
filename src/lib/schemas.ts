import { z } from "zod";
import { ARTICLE_STATUS } from "@/lib/labels";
import { zColor, zIncidentType, zLongText, zOptDate, zOptText, zOptUrl, zOptUuid, zText, zVerification } from "@/lib/validation";

/** 관리자 API 입력 스키마 (route 파일 간 공유) */

export const IncidentFields = z.object({
  title: zText(150),
  type: zIncidentType,
  eventId: zOptUuid,
  summary: zOptText(3000, true),
  occurredAt: zOptDate,
  verificationStatus: zVerification,
  isPublic: z.boolean(),
  publishAt: zOptDate,
  isSensitive: z.boolean(),
  isClosed: z.boolean().default(false),
  teamIds: z.array(z.uuid()).max(20).default([]),
});

export const BreakingFields = z.object({
  title: zText(120),
  body: zOptText(1000, true),
  priority: z.enum(["URGENT", "NORMAL"]),
  verificationStatus: zVerification,
  incidentId: zOptUuid,
  isPinned: z.boolean().default(false),
  showOnOverlay: z.boolean().default(true),
  startsAt: zOptDate,
  endsAt: zOptDate,
});

export const ArticleFields = z.object({
  title: zText(150),
  lead: zOptText(400, true),
  body: zLongText(30000, 0),
  status: z.enum(ARTICLE_STATUS),
  verificationStatus: zVerification,
  isFeatured: z.boolean(),
  coverUrl: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      if (!v) return null;
      if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(v)) return v;
      const r = zOptUrl.safeParse(v);
      if (!r.success || !r.data) {
        ctx.addIssue({ code: "custom", message: "커버 이미지는 업로드 이미지 또는 https 주소만 가능합니다." });
        return z.NEVER;
      }
      return r.data;
    }),
  incidentId: zOptUuid,
  publishedAt: zOptDate.optional(),
});

export const EventFields = z.object({
  name: zText(80),
  season: zOptText(40),
  description: zOptText(2000, true),
  startsAt: zOptDate,
  endsAt: zOptDate,
  isActive: z.boolean(),
});

const zImageRef = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (!v) return null;
    if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(v)) return v;
    const r = zOptUrl.safeParse(v);
    if (!r.success || !r.data) {
      ctx.addIssue({ code: "custom", message: "이미지는 업로드 이미지 또는 https 주소만 가능합니다." });
      return z.NEVER;
    }
    return r.data;
  });

export const TeamFields = z.object({
  eventId: z.uuid(),
  name: zText(40),
  shortName: zOptText(10),
  color: zColor,
  logoUrl: zImageRef,
  description: zOptText(2000, true),
  statusLabel: zOptText(20),
  score: z.number().int().min(-100000).max(100000),
  isEliminated: z.boolean(),
  isPublic: z.boolean(),
});

export const PlayerFields = z.object({
  nickname: zText(40),
  profile: zOptText(1000, true),
  streamUrl: zOptUrl,
  avatarUrl: zImageRef,
});

export const EpisodeFields = z.object({
  title: zText(120),
  number: z.number().int().min(0).max(100000).nullable(),
  scheduledAt: zOptDate,
  eventId: zOptUuid,
  liveUrl: zOptUrl,
  replayUrl: zOptUrl,
  anchorIds: z.array(z.uuid()).max(6),
});

export const RundownItemFields = z.object({
  kind: z.enum(["ARTICLE", "CLIP", "BREAKING", "SEGMENT"]),
  title: zText(150),
  articleId: zOptUuid,
  clipId: zOptUuid,
  breakingId: zOptUuid,
  anchorId: zOptUuid,
  plannedSeconds: z.number().int().min(0).max(7200),
  notes: zOptText(1000, true),
});

export const PollFields = z.object({
  question: zText(150),
  description: zOptText(500, true),
  resultVisibility: z.enum(["ALWAYS", "AFTER_VOTE", "AFTER_CLOSE"]),
  startsAt: zOptDate,
  endsAt: zOptDate,
  eventId: zOptUuid,
});
