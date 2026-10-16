import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { listPublicClips } from "@/server/public";
import { ClipCard } from "@/components/site/cards";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "핫 클립" };

export default async function ClipsPage({ searchParams }: { searchParams: Promise<{ hot?: string }> }) {
  const { hot } = await searchParams;
  const hotOnly = hot === "1";
  const rows = await listPublicClips(await getDb(), { hotOnly, limit: 48 });

  return (
    <>
      <PageHeader
        kicker="HOT CLIPS"
        title="핫 클립"
        desc="운영진이 승인한 클립입니다. 임베드를 허용하지 않는 영상은 원본 사이트에서 재생됩니다."
        actions={
          <>
            <Link href={hotOnly ? "/clips" : "/clips?hot=1"} className="btn">
              {hotOnly ? "전체 보기" : "HOT만 보기"}
            </Link>
            <Link href="/clips/new" className="btn btn-red">
              클립 제보
            </Link>
          </>
        }
      />
      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <ClipCard key={r.clip.id} clip={r.clip} teamName={r.teamName} teamColor={r.teamColor} playerName={r.playerName} embed />
          ))}
        </div>
      ) : (
        <EmptyState title="공개된 클립이 없습니다" action={<Link href="/clips/new" className="btn mt-2">클립 제보하기</Link>} />
      )}
    </>
  );
}
