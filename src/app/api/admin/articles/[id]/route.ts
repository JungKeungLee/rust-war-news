import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { articleClips, articleRevisions, articles, clips, users } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { ArticleFields } from "@/lib/schemas";
import { zOptText, zUuid, zVersion } from "@/lib/validation";
import { markReportsPublished } from "../shared";

export const GET = adminRoute<{ id: string }>("articles.manage", async ({ db, params }) => {
  const id = zUuid.parse(params.id);
  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) throw notFound("기사");
  const [linked, revisions] = await Promise.all([
    db
      .select({ id: clips.id, title: clips.title, status: clips.status, url: clips.url })
      .from(articleClips)
      .innerJoin(clips, eq(clips.id, articleClips.clipId))
      .where(eq(articleClips.articleId, id))
      .orderBy(asc(articleClips.position)),
    db
      .select({ id: articleRevisions.id, version: articleRevisions.version, title: articleRevisions.title, status: articleRevisions.status, note: articleRevisions.note, createdAt: articleRevisions.createdAt, editor: users.displayName })
      .from(articleRevisions)
      .leftJoin(users, eq(users.id, articleRevisions.editedBy))
      .where(eq(articleRevisions.articleId, id))
      .orderBy(desc(articleRevisions.version))
      .limit(50),
  ]);
  return { article, clips: linked, revisions };
});

const PatchInput = ArticleFields.extend({ version: zVersion, note: zOptText(200).optional(), clipIds: z.array(z.uuid()).max(20).optional() });

/** 기사 수정 (버전 검사 + 수정 이력 저장 + 클립 연결) */
export const PATCH = adminRoute<{ id: string }>("articles.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const { version, note, clipIds, ...input } = await readJson(req, PatchInput);
  const [current] = await db.select().from(articles).where(eq(articles.id, id));
  if (!current) throw notFound("기사");

  const values: Record<string, unknown> = { ...input };
  if (input.status === "PUBLISHED") values.publishedAt = input.publishedAt ?? current.publishedAt ?? new Date();
  else delete values.publishedAt;

  return db.transaction(async (tx) => {
    const row = await versionedUpdate(tx, articles, id, version, values);
    await tx.insert(articleRevisions).values({ articleId: id, version: row.version, title: row.title, lead: row.lead, body: row.body, status: row.status, note: note ?? null, editedBy: session.userId });
    if (clipIds) {
      await tx.delete(articleClips).where(eq(articleClips.articleId, id));
      const unique = [...new Set(clipIds)];
      if (unique.length) await tx.insert(articleClips).values(unique.map((clipId, position) => ({ articleId: id, clipId, position })));
    }
    if (row.status === "PUBLISHED") await markReportsPublished(tx, row.incidentId);
    await audit(current.status !== row.status ? `ARTICLE_${row.status}` : "ARTICLE_UPDATE", "article", id, { version: row.version, status: row.status, clipIds }, tx);
    return { article: row };
  });
});
