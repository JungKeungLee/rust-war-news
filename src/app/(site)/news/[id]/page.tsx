import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { getPublicArticle } from "@/server/public";
import { ArticleCard, ClipCard } from "@/components/site/cards";
import { FlagButton } from "@/components/site/FlagButton";
import { Paragraphs, TeamChip, TypeBadge, VerificationBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const data = await getPublicArticle(await getDb(), id);
  return data ? { title: data.article.title, description: data.article.lead ?? undefined } : {};
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getPublicArticle(await getDb(), id);
  if (!data) notFound();
  const { article: a, incident, clips, related, source, teams } = data;
  const unconfirmed = a.verificationStatus !== "CONFIRMED";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <article className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/news" className="text-sm text-muted hover:text-ink">
            ← 뉴스
          </Link>
          <VerificationBadge status={a.verificationStatus} />
          {incident && <TypeBadge type={incident.type} />}
        </div>
        <h1 className="text-2xl font-black leading-tight sm:text-4xl">{a.title}</h1>
        {a.lead && <p className="mt-3 text-lg text-muted">{a.lead}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-line py-2 font-mono text-xs text-dim">
          <span>발행 {fmtDateTime(a.publishedAt)}</span>
          {a.updatedAt > (a.publishedAt ?? a.updatedAt) && <span>수정 {fmtDateTime(a.updatedAt)}</span>}
          <span>RWN 뉴스</span>
        </div>

        {unconfirmed && (
          <div className="mt-4 rounded border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
            이 기사에는 아직 사실 확인이 끝나지 않은 내용이 포함되어 있습니다. 확인 결과에 따라 내용이 정정될 수 있습니다.
          </div>
        )}

        {a.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.coverUrl} alt="" referrerPolicy="no-referrer" className="mt-6 w-full rounded object-cover" />
        )}

        <Paragraphs text={a.body} className="prose-news mt-6" />

        {source && (
          <div className="mt-6 rounded border border-line bg-panel2 p-3 text-sm text-muted">
            이 기사는 {fmtDateTime(source.startsAt)} 속보 「{source.title}」를 확장한 기사입니다.
          </div>
        )}

        {clips.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-extrabold">관련 클립</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {clips.map((c) => (
                <ClipCard key={c.id} clip={c} embed />
              ))}
            </div>
          </section>
        )}
      </article>

      <aside className="flex flex-col gap-4">
        {incident && (
          <div className="panel p-4">
            <div className="panel-head mb-2">관련 사건</div>
            <div className="font-bold">{incident.title}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TypeBadge type={incident.type} />
              <VerificationBadge status={incident.verificationStatus} />
            </div>
            <div className="mt-2 font-mono text-xs text-dim">발생 {fmtDateTime(incident.occurredAt)}</div>
            {teams.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {teams.map((t) => (
                  <Link key={t.id} href={`/teams/${t.id}`}>
                    <TeamChip name={t.name} color={t.color} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {related.length > 0 && (
          <div className="panel p-4">
            <div className="panel-head mb-1">같은 사건 기사</div>
            {related.map((r) => (
              <ArticleCard key={r.id} a={r} variant="compact" />
            ))}
          </div>
        )}
        <Link href="/reports/new" className="btn btn-red w-full">
          이 사건 관련 제보하기
        </Link>
        <FlagButton targetType="article" targetId={a.id} />
      </aside>
    </div>
  );
}
