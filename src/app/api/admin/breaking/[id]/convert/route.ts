import { eq } from "drizzle-orm";
import { articleRevisions, articles, breakingNews, breakingRevisions } from "@/db/schema";
import { adminRoute } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { zUuid } from "@/lib/validation";

/**
 * 속보 → 정규 기사 전환. 새 기사 초안을 만들고 원본 속보는 그대로 보존한다(링크만 연결).
 */
export const POST = adminRoute<{ id: string }>("articles.manage", async ({ db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const [b] = await db.select().from(breakingNews).where(eq(breakingNews.id, id));
  if (!b) throw notFound("속보");
  if (b.convertedArticleId) throw new ApiError(409, "이미 기사로 전환된 속보입니다.", { articleId: b.convertedArticleId });

  return db.transaction(async (tx) => {
    const body = [b.body ?? "", "", "(속보 원문을 바탕으로 작성 중인 기사입니다.)"].join("\n").trim();
    const [article] = await tx
      .insert(articles)
      .values({
        title: b.title,
        lead: b.body?.slice(0, 200) ?? null,
        body,
        incidentId: b.incidentId,
        sourceBreakingId: b.id,
        verificationStatus: b.verificationStatus,
        authorId: session.userId,
      })
      .returning();
    await tx.insert(articleRevisions).values({ articleId: article.id, version: 1, title: article.title, lead: article.lead, body: article.body, status: article.status, note: "속보에서 전환", editedBy: session.userId });
    // 원본 속보 내용은 변경하지 않고 연결 정보만 기록
    await tx.update(breakingNews).set({ convertedArticleId: article.id, updatedAt: new Date() }).where(eq(breakingNews.id, id));
    await tx.insert(breakingRevisions).values({ breakingId: id, action: "CONVERT", title: b.title, body: b.body, note: `기사 ${article.id}`, userId: session.userId });
    await audit("BREAKING_CONVERT", "breaking", id, { articleId: article.id }, tx);
    return { article };
  });
});
