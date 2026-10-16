import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { countArticles, listArticles } from "@/server/public";
import { ArticleCard } from "@/components/site/cards";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "뉴스" };
const PAGE_SIZE = 12;

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Math.min(500, Number(pageRaw) || 1));
  const db = await getDb();
  const [items, total] = await Promise.all([listArticles(db, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), countArticles(db)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader kicker="RWN NEWS" title="뉴스" desc="운영진이 확인·편집해 발행한 정규 기사입니다. 확인 상태 배지로 사실 확인 여부를 표시합니다." />
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState title="발행된 기사가 없습니다" />
      )}
      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="페이지">
          {page > 1 && (
            <Link href={`/news?page=${page - 1}`} className="btn btn-sm">
              ← 이전
            </Link>
          )}
          <span className="font-mono text-sm text-muted">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={`/news?page=${page + 1}`} className="btn btn-sm">
              다음 →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
