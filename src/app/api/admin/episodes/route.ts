import { desc } from "drizzle-orm";
import { episodes } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { EpisodeFields } from "@/lib/schemas";
import { assertAnchors, setEpisodeAnchors } from "@/server/episodes";

export const GET = adminRoute("rundown.operate", async ({ db }) => {
  const items = await db.select().from(episodes).orderBy(desc(episodes.createdAt)).limit(100);
  return { items };
});

/** 방송 회차 생성 (진행자 배정 포함) */
export const POST = adminRoute("episodes.manage", async ({ req, db, audit }) => {
  const { anchorIds, ...input } = await readJson(req, EpisodeFields);
  return db.transaction(async (tx) => {
    await assertAnchors(tx, anchorIds);
    const [row] = await tx.insert(episodes).values(input).returning();
    await setEpisodeAnchors(tx, row.id, anchorIds);
    await audit("EPISODE_CREATE", "episode", row.id, { title: row.title }, tx);
    return { episode: row };
  });
});
