import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { listArchive } from "@/server/public";
import { EmptyState, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { RUNDOWN_KIND_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "방송 아카이브" };

export default async function ArchivePage() {
  const list = await listArchive(await getDb());
  return (
    <>
      <PageHeader kicker="ARCHIVE" title="뉴스 방송 아카이브" desc="종료된 정규 뉴스 방송의 다시보기와 보도 순서입니다." />
      {list.length === 0 ? (
        <EmptyState title="공개된 방송 기록이 없습니다" />
      ) : (
        <div className="flex flex-col gap-4">
          {list.map(({ episode: e, items }) => (
            <article key={e.id} className="panel p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-mono text-xs text-dim">
                    {e.number != null && `제${e.number}회 · `}
                    {fmtDateTime(e.startedAt ?? e.scheduledAt)} 방송
                  </div>
                  <h2 className="mt-1 text-xl font-extrabold">{e.title}</h2>
                </div>
                {e.replayUrl ? (
                  <a href={e.replayUrl} target="_blank" rel="noopener noreferrer" className="btn btn-red shrink-0">
                    ▶ 다시보기
                  </a>
                ) : (
                  <span className="text-sm text-dim">다시보기 준비 중</span>
                )}
              </div>
              {items.length > 0 && (
                <ol className="mt-4 grid gap-1 border-t border-line pt-3 sm:grid-cols-2">
                  {items.map((it, idx) => (
                    <li key={idx} className="flex gap-2 text-sm">
                      <span className="w-6 shrink-0 font-mono text-dim">{idx + 1}</span>
                      <span className="shrink-0 text-xs text-muted">[{RUNDOWN_KIND_LABEL[it.kind]}]</span>
                      {it.articleId ? (
                        <Link href={`/news/${it.articleId}`} className="hover:underline">
                          {it.title}
                        </Link>
                      ) : (
                        <span>{it.title}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
