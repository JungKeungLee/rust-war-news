import Link from "next/link";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { INCIDENT_TYPE_LABEL, type IncidentType, type TeamStatus } from "@/lib/labels";
import { CoverPlaceholder, TeamChip, TypeBadge, VerificationBadge, cx } from "@/components/ui";
import { TeamStatusBadge } from "./live-ui";

export type TeamCardData = {
  id: string;
  name: string;
  shortName: string | null;
  color: string;
  logoUrl: string | null;
  description: string | null;
  isEliminated: boolean;
  memberCount: number;
  status: TeamStatus;
  statusMessage: string | null;
  latestIncident: { id: string; title: string; type: string; verificationStatus: string; at: string } | null;
  updatedAt: string | null;
};

/** 팀 상황 카드 (공개 지통실·메인 미리보기 공용). 표시 값은 모두 서버에서 공개 필터를 거친 데이터 */
export function TeamCard({ t, now }: { t: TeamCardData; now?: number | null }) {
  return (
    <Link
      href={`/control-room/${t.id}`}
      className={cx("panel group flex flex-col overflow-hidden hover:border-[#3a4a68]", t.status === "ALERT" && "border-alert/70")}
    >
      <div className="h-1.5" style={{ background: t.color }} />
      <div className="flex items-start gap-3 p-3">
        {t.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logoUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded object-cover" />
        ) : (
          <CoverPlaceholder label={(t.shortName ?? t.name).slice(0, 3)} color={t.color} className="h-12 w-12 shrink-0 rounded" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cx("truncate font-extrabold group-hover:underline", t.isEliminated && "text-dim line-through")}>{t.name}</span>
            <TeamStatusBadge status={t.status} />
          </div>
          <div className="mt-0.5 text-xs text-muted">선수 {t.memberCount}명</div>
        </div>
      </div>
      {t.statusMessage && <p className="mx-3 mb-2 line-clamp-2 rounded bg-panel2 px-2 py-1 text-xs text-ink">{t.statusMessage}</p>}
      {t.description && <p className="mx-3 line-clamp-2 text-xs text-dim">{t.description}</p>}
      <div className="mt-auto border-t border-line/70 px-3 py-2 text-xs">
        {t.latestIncident ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-dim">최신</span>
            <span className="shrink-0 rounded bg-panel2 px-1 text-[0.7rem] font-bold text-muted">{INCIDENT_TYPE_LABEL[t.latestIncident.type as IncidentType]}</span>
            <span className="truncate font-semibold">{t.latestIncident.title}</span>
          </div>
        ) : (
          <span className="text-dim">공개된 사건 없음</span>
        )}
        <div className="mt-1 font-mono text-[0.7rem] text-dim" suppressHydrationWarning>
          업데이트 {t.updatedAt ? (now ? fmtRelative(t.updatedAt, now) : fmtDateTime(t.updatedAt)) : "-"}
        </div>
      </div>
    </Link>
  );
}

export type TimelineItem = {
  id: string;
  title: string;
  type: string;
  summary: string | null;
  verificationStatus: string;
  at: string;
  teams: { id: string; name: string; color: string }[];
  articles?: { id: string; title: string }[];
};

/** 공개 사건 타임라인. 여러 팀이 연결된 사건은 모든 팀을 함께 표시 */
export function IncidentTimeline({ items, empty = "공개된 사건이 없습니다." }: { items: TimelineItem[]; empty?: string }) {
  if (!items.length) return <p className="panel p-4 text-sm text-muted">{empty}</p>;
  return (
    <ol className="panel relative divide-y divide-line/60">
      {items.map((i) => (
        <li key={i.id} className="flex flex-col gap-1 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-dim">{fmtDateTime(i.at)}</span>
            <TypeBadge type={i.type} />
            <VerificationBadge status={i.verificationStatus} />
          </div>
          <div className="font-semibold">{i.title}</div>
          {i.summary && <p className="line-clamp-2 text-sm text-muted">{i.summary}</p>}
          <div className="flex flex-wrap items-center gap-1">
            {i.teams.map((t) => (
              <Link key={t.id} href={`/control-room/${t.id}`}>
                <TeamChip name={t.name} color={t.color} />
              </Link>
            ))}
            {i.articles?.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="ml-1 text-xs text-blue-300 hover:underline">
                기사: {a.title} →
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
