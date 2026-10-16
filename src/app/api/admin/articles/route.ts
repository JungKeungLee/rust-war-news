import { desc, eq } from "drizzle-orm";
import { articleRevisions, articles, incidents } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ArticleFields } from "@/lib/schemas";
import { markReportsPublished } from "./shared";

export const GET = adminRoute("articles.manage", async ({ db }) => {
  const rows = await db
    .select({ article: articles, incidentTitle: incidents.title })
    .from(articles)
    .leftJoin(incidents, eq(incidents.id, articles.incidentId))
    .orderBy(desc(articles.updatedAt))
    .limit(200);
  return { items: rows.map((r) => ({ ...r.article, incidentTitle: r.incidentTitle })) };
});

export const POST = adminRoute("articles.manage", async ({ req, db, session, audit }) => {
  const input = await readJson(req, ArticleFields);
  return db.transaction(async (tx) => {
    const publishedAt = input.status === "PUBLISHED" ? (input.publishedAt ?? new Date()) : null;
    const [row] = await tx
      .insert(articles)
      .values({ ...input, publishedAt, authorId: session.userId })
      .returning();
    await tx.insert(articleRevisions).values({ articleId: row.id, version: row.version, title: row.title, lead: row.lead, body: row.body, status: row.status, note: "작성", editedBy: session.userId });
    if (row.status === "PUBLISHED") await markReportsPublished(tx, row.incidentId);
    await audit("ARTICLE_CREATE", "article", row.id, { title: row.title, status: row.status }, tx);
    return { article: row };
  });
});
