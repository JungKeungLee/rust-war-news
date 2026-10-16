import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { articleClips, articleRevisions, articles, users } from "@/db/schema";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const metadata = { title: "기사 편집" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePagePermission("articles.manage"))) return <Forbidden />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [a] = await db.select().from(articles).where(eq(articles.id, id));
  if (!a) notFound();
  const [lookups, linked, revisions] = await Promise.all([
    getLookups(db),
    db.select({ clipId: articleClips.clipId }).from(articleClips).where(eq(articleClips.articleId, id)).orderBy(asc(articleClips.position)),
    db
      .select({ version: articleRevisions.version, title: articleRevisions.title, status: articleRevisions.status, note: articleRevisions.note, createdAt: articleRevisions.createdAt, editor: users.displayName })
      .from(articleRevisions)
      .leftJoin(users, eq(users.id, articleRevisions.editedBy))
      .where(eq(articleRevisions.articleId, id))
      .orderBy(desc(articleRevisions.id))
      .limit(30),
  ]);

  return (
    <>
      <AdminTitle title="기사 편집" />
      <ArticleEditor
        key={`${a.id}:${a.version}`}
        incidents={lookups.incidents}
        clips={lookups.clips}
        initial={{
          id: a.id,
          version: a.version,
          title: a.title,
          lead: a.lead ?? "",
          body: a.body,
          status: a.status,
          verificationStatus: a.verificationStatus,
          isFeatured: a.isFeatured,
          coverUrl: a.coverUrl,
          incidentId: a.incidentId,
          clipIds: linked.map((l) => l.clipId),
          sourceBreakingId: a.sourceBreakingId,
        }}
        revisions={revisions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </>
  );
}
