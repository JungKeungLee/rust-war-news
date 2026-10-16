import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { getPublicLiveState } from "@/server/live";
import { listBreakingHistory } from "@/server/public";
import { BreakingLive } from "@/components/site/BreakingLive";
import { Badge, PageHeader, VerificationBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "실시간 속보" };

export default async function BreakingPage() {
  const db = await getDb();
  const [live, history] = await Promise.all([getPublicLiveState(db), listBreakingHistory(db, 50)]);
  const activeIds = new Set(live.breaking.map((b) => b.id));
  const past = history.filter((h) => !activeIds.has(h.id));

  return (
    <>
      <PageHeader kicker="BREAKING" title="실시간 속보" desc="약 4초마다 자동으로 갱신됩니다. 미확인 속보는 별도로 표시됩니다." />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <BreakingLive initial={live} />
        <section>
          <h2 className="mb-3 text-lg font-extrabold">지난 속보</h2>
          {past.length === 0 ? (
            <p className="panel p-4 text-sm text-muted">기록이 없습니다.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {past.map((b) => (
                <li key={b.id} className="p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs text-dim">{fmtDateTime(b.startsAt)}</span>
                    <VerificationBadge status={b.verificationStatus} />
                    {b.correctedAt && <Badge tone="blue">정정</Badge>}
                  </div>
                  <div className="font-semibold">{b.title}</div>
                  {b.convertedArticleId && (
                    <Link href={`/news/${b.convertedArticleId}`} className="mt-1 inline-block text-sm text-blue-300 hover:underline">
                      관련 기사 보기 →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
