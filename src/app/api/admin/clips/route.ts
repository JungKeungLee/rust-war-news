import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { clips, incidents, players, teams } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { buildEmbed, siteHostFromEnv } from "@/lib/clips/embed";
import { zOptText, zOptUrl, zOptUuid, zText } from "@/lib/validation";

export const GET = adminRoute("clips.manage", async ({ db }) => {
  const rows = await db
    .select({ clip: clips, teamName: teams.name, playerName: players.nickname, incidentTitle: incidents.title })
    .from(clips)
    .leftJoin(teams, eq(teams.id, clips.teamId))
    .leftJoin(players, eq(players.id, clips.playerId))
    .leftJoin(incidents, eq(incidents.id, clips.incidentId))
    .orderBy(desc(clips.createdAt))
    .limit(200);
  return {
    items: rows.map((r) => {
      const { submitterIpHash: _ip, ...clip } = r.clip;
      void _ip;
      return { ...clip, teamName: r.teamName, playerName: r.playerName, incidentTitle: r.incidentTitle };
    }),
  };
});

const CreateInput = z.object({
  title: zText(100),
  url: zOptUrl.refine((v) => !!v, "영상 주소를 입력하세요."),
  description: zOptText(1000, true),
  teamId: zOptUuid,
  playerId: zOptUuid,
  incidentId: zOptUuid,
});

/** 관리자가 직접 등록하는 클립은 즉시 승인 상태 */
export const POST = adminRoute("clips.manage", async ({ req, db, session, audit }) => {
  const input = await readJson(req, CreateInput);
  const embed = buildEmbed(input.url!, siteHostFromEnv(req.nextUrl.hostname));
  const [row] = await db
    .insert(clips)
    .values({
      ...input,
      url: input.url!,
      platform: embed.platform,
      embedUrl: embed.embedUrl,
      thumbnailUrl: embed.thumbnailUrl,
      submitterNickname: session.displayName,
      status: "APPROVED",
      reviewedBy: session.userId,
      reviewedAt: new Date(),
    })
    .returning();
  await audit("CLIP_CREATE", "clip", row.id, { title: row.title });
  return { clip: row };
});
