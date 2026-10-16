import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { listPublicReports } from "@/server/public";
import { Badge, EmptyState, PageHeader, Paragraphs, TeamChip, TypeBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "제보" };

export default async function ReportsPage() {
  const reports = await listPublicReports(await getDb(), 40);
  return (
    <>
      <PageHeader
        kicker="FIELD REPORTS"
        title="시청자 제보"
        desc="운영진이 검토해 승인한 제보만 공개됩니다. 접수·확인 중·반려된 제보와 민감한 작전 정보는 공개되지 않습니다."
        actions={
          <Link href="/reports/new" className="btn btn-red">
            제보하기
          </Link>
        }
      />
      {reports.length === 0 ? (
        <EmptyState title="공개된 제보가 없습니다" desc="승인된 제보가 이곳에 표시됩니다." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {reports.map((r) => (
            <li key={r.id} className="panel flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <TypeBadge type={r.type} />
                {r.status === "PUBLISHED" ? <Badge tone="blue">기사화</Badge> : <Badge tone="green">승인</Badge>}
                {r.isSensitive && <Badge tone="amber">요약 공개</Badge>}
                <span className="font-mono text-xs text-dim">발생 {fmtDateTime(r.occurredAt ?? r.createdAt)}</span>
              </div>
              <h2 className="text-lg font-bold">{r.title}</h2>
              <Paragraphs text={r.body} className="line-clamp-6 text-sm text-muted [&_p]:mb-2" />
              {r.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {r.images.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="제보 이미지" loading="lazy" className="aspect-square w-full rounded object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-dim">
                <div className="flex flex-wrap gap-1">
                  {r.teams.map((t) => (
                    <TeamChip key={t.id} name={t.name} color={t.color} />
                  ))}
                </div>
                <span>제보자: {r.reporter}</span>
              </div>
              {r.videoUrl && (
                <a href={r.videoUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-blue-300 hover:underline">
                  관련 영상 ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
