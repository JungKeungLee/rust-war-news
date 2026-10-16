import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { articles, incidents } from "@/db/schema";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { StatusPill } from "@/components/admin/forms";
import { fmtDateTime } from "@/lib/format";
import { ARTICLE_STATUS_LABEL, VERIFICATION_LABEL } from "@/lib/labels";

export const metadata = { title: "기사 관리" };

export default async function AdminArticlesPage() {
  if (!(await requirePagePermission("articles.manage"))) return <Forbidden />;
  const db = await getDb();
  const rows = await db
    .select({ a: articles, incidentTitle: incidents.title })
    .from(articles)
    .leftJoin(incidents, eq(incidents.id, articles.incidentId))
    .orderBy(desc(articles.updatedAt))
    .limit(200);

  return (
    <>
      <AdminTitle
        title="기사 관리"
        desc="정규 뉴스 기사 작성·발행. 수정할 때마다 이력이 남습니다."
        actions={
          <Link href="/admin/articles/new" className="btn btn-red">
            + 새 기사
          </Link>
        }
      />
      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-muted">기사가 없습니다.</div>
      ) : (
        <div className="panel divide-y divide-line">
          {rows.map(({ a, incidentTitle }) => (
            <Link key={a.id} href={`/admin/articles/${a.id}`} className="flex flex-col gap-1 p-3 hover:bg-panel2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex shrink-0 gap-1">
                <StatusPill tone={a.status === "PUBLISHED" ? "green" : a.status === "REVIEW" ? "blue" : "default"}>{ARTICLE_STATUS_LABEL[a.status]}</StatusPill>
                <StatusPill tone={a.verificationStatus === "CONFIRMED" ? "green" : "amber"}>{VERIFICATION_LABEL[a.verificationStatus]}</StatusPill>
                {a.isFeatured && <StatusPill tone="red">주요</StatusPill>}
              </div>
              <span className="min-w-0 flex-1 truncate font-semibold">{a.title}</span>
              <span className="truncate text-xs text-dim sm:w-48">{incidentTitle ?? "사건 미연결"}</span>
              <span className="shrink-0 font-mono text-xs text-dim">v{a.version} · {fmtDateTime(a.updatedAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
