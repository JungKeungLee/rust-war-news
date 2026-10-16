import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { clips, players, teams } from "@/db/schema";
import { publicRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { buildEmbed, siteHostFromEnv } from "@/lib/clips/embed";
import { zOptText, zOptUrl, zOptUuid, zText } from "@/lib/validation";
import { getSettings } from "@/server/settings";
import { listPublicClips } from "@/server/public";

const ClipInput = z.object({
  title: zText(100, 2),
  url: zOptUrl.refine((v) => !!v, "영상 주소를 입력하세요."),
  description: zOptText(1000, true),
  teamId: zOptUuid,
  playerId: zOptUuid,
  nickname: zOptText(30),
  isAnonymous: z.boolean().default(false),
  elapsedMs: z.number().optional(),
  website: z.string().optional(),
});

export const GET = publicRoute(async ({ db }) => ({ clips: await listPublicClips(db, { limit: 40 }) }));

/** 클립 제보 (관리자 승인 전에는 비공개) */
export const POST = publicRoute(async ({ req, db, ipHash }) => {
  const settings = await getSettings(db);
  if (!settings.intake.clipsOpen) throw new ApiError(403, "현재 클립 접수가 중단되어 있습니다.");
  await rateLimit(db, `clip:10m:${ipHash}`, 5, 600);
  await rateLimit(db, `clip:1d:${ipHash}`, 40, 86400);

  const input = await readJson(req, ClipInput);
  if (input.website?.trim()) return { ok: true };
  if ((input.elapsedMs ?? 0) < 1500) throw new ApiError(400, "입력 시간이 너무 짧습니다.");

  const url = input.url!;
  const [dup] = await db
    .select({ id: clips.id })
    .from(clips)
    .where(and(eq(clips.url, url), gt(clips.createdAt, sql`now() - interval '1 day'`)))
    .limit(1);
  if (dup) throw new ApiError(409, "이미 접수된 클립입니다.");

  if (input.teamId) {
    const [t] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.isPublic, true)));
    if (!t) throw new ApiError(400, "팀을 찾을 수 없습니다.");
  }
  if (input.playerId) {
    const [p] = await db.select({ id: players.id }).from(players).where(eq(players.id, input.playerId));
    if (!p) throw new ApiError(400, "선수를 찾을 수 없습니다.");
  }

  const embed = buildEmbed(url, siteHostFromEnv(req.nextUrl.hostname));
  const [row] = await db
    .insert(clips)
    .values({
      title: input.title,
      url,
      description: input.description,
      platform: embed.platform,
      embedUrl: embed.embedUrl,
      thumbnailUrl: embed.thumbnailUrl,
      teamId: input.teamId,
      playerId: input.playerId,
      submitterNickname: input.isAnonymous ? null : input.nickname,
      isAnonymous: input.isAnonymous,
      submitterIpHash: ipHash,
    })
    .returning({ id: clips.id });
  return { ok: true, receipt: row.id.slice(0, 8).toUpperCase() };
});
