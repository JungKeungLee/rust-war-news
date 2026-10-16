import Link from "next/link";
import { CLIP_PLATFORM_LABEL } from "@/lib/labels";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { CoverPlaceholder, TeamChip, VerificationBadge, cx } from "@/components/ui";

type ArticleCardData = {
  id: string;
  title: string;
  lead: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  verificationStatus: string;
};

export function ArticleCard({ a, variant = "default" }: { a: ArticleCardData; variant?: "default" | "hero" | "compact" }) {
  if (variant === "compact") {
    return (
      <Link href={`/news/${a.id}`} className="group flex gap-3 border-b border-line/60 py-3 last:border-0">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <VerificationBadge status={a.verificationStatus} />
            <span className="font-mono text-xs text-dim">{fmtRelative(a.publishedAt)}</span>
          </div>
          <div className="line-clamp-2 font-bold group-hover:underline">{a.title}</div>
        </div>
      </Link>
    );
  }
  const hero = variant === "hero";
  return (
    <Link href={`/news/${a.id}`} className="group panel flex flex-col overflow-hidden hover:border-[#3a4a68]">
      {a.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverUrl} alt="" referrerPolicy="no-referrer" className={cx("w-full object-cover", hero ? "aspect-[16/8]" : "aspect-video")} />
      ) : (
        <CoverPlaceholder label="RWN NEWS" className={hero ? "aspect-[16/5]" : "aspect-[16/6]"} />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <VerificationBadge status={a.verificationStatus} />
          <span className="font-mono text-xs text-dim">{fmtDateTime(a.publishedAt)}</span>
        </div>
        <h3 className={cx("font-extrabold leading-snug group-hover:underline", hero ? "text-2xl sm:text-3xl" : "text-lg")}>{a.title}</h3>
        {a.lead && <p className={cx("text-sm text-muted", hero ? "line-clamp-3" : "line-clamp-2")}>{a.lead}</p>}
      </div>
    </Link>
  );
}

type ClipData = {
  id: string;
  title: string;
  url: string;
  platform: keyof typeof CLIP_PLATFORM_LABEL;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  isHot: boolean;
  isAnonymous: boolean;
  submitterNickname: string | null;
  description?: string | null;
};

/** 임베드 가능한 클립은 클릭 시 플레이어를, 아니면 외부 링크로 연결한다. */
export function ClipCard({ clip, teamName, teamColor, playerName, embed = false }: { clip: ClipData; teamName?: string | null; teamColor?: string | null; playerName?: string | null; embed?: boolean }) {
  return (
    <div className="panel flex flex-col overflow-hidden">
      {embed && clip.embedUrl ? (
        <iframe
          src={clip.embedUrl}
          title={clip.title}
          className="aspect-video w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <a href={clip.url} target="_blank" rel="noopener noreferrer nofollow" className="relative block">
          {clip.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.thumbnailUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-video w-full object-cover" />
          ) : (
            <CoverPlaceholder label={CLIP_PLATFORM_LABEL[clip.platform]} color={teamColor} className="aspect-video" />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-bold">▶ {clip.embedUrl ? "재생" : "외부에서 보기"}</span>
          </span>
        </a>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {clip.isHot && <span className="rounded bg-alert px-1.5 py-0.5 text-[0.7rem] font-black text-white">HOT</span>}
          <span className="rounded bg-panel2 px-1.5 py-0.5 text-[0.7rem] font-bold text-muted ring-1 ring-line">{CLIP_PLATFORM_LABEL[clip.platform]}</span>
          {teamName && teamColor && <TeamChip name={teamName} color={teamColor} />}
        </div>
        <div className="line-clamp-2 font-bold">{clip.title}</div>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-dim">
          <span>
            {playerName ? `${playerName} · ` : ""}제보: {clip.isAnonymous || !clip.submitterNickname ? "익명" : clip.submitterNickname}
          </span>
          <a href={clip.url} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 text-muted hover:text-ink">
            원본 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
