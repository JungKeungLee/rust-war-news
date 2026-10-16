import Link from "next/link";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { getWarRoom } from "@/server/public";
import { EmptyState, PageHeader, TeamChip, TypeBadge, VerificationBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { INCIDENT_TYPE_LABEL, type IncidentType } from "@/lib/labels";

export const metadata: Metadata = { title: "전쟁 상황판" };

export default async function WarRoomPage() {
  const { event, teams, incidents } = await getWarRoom(await getDb());
  const confirmed = incidents.filter((i) => i.verificationStatus === "CONFIRMED");
  const unconfirmed = incidents.filter((i) => i.verificationStatus !== "CONFIRMED" && i.verificationStatus !== "FALSE");
  const typeCounts = Object.entries(
    incidents.reduce<Record<string, number>>((acc, i) => ((acc[i.type] = (acc[i.type] ?? 0) + 1), acc), {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxScore = Math.max(1, ...teams.map((t) => t.score));

  return (
    <div className="ops-grid -mx-4 px-4 py-2">
      <PageHeader kicker="WAR ROOM" title={event ? `${event.name} 전쟁 상황판` : "전쟁 상황판"} desc="공개 승인된 정보만 표시합니다. 작전 위치 등 민감 정보는 공개 가능 시각 이후에 반영됩니다." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="공개 사건" value={incidents.length} />
        <Stat label="확인 완료" value={confirmed.length} tone="text-ok" />
        <Stat label="확인 중·미확인" value={unconfirmed.length} tone="text-warn" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-4">
          <div className="panel-head mb-3">Team Standing</div>
          {teams.length === 0 ? (
            <EmptyState title="진행 중인 대결의 팀 정보가 없습니다" />
          ) : (
            <ul className="flex flex-col gap-3">
              {teams.map((t, i) => (
                <li key={t.id}>
                  <Link href={`/teams/${t.id}`} className="block rounded p-1 hover:bg-panel2">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="w-5 font-mono text-sm text-dim">{i + 1}</span>
                      <span className={`flex-1 font-bold ${t.isEliminated ? "text-dim line-through" : ""}`}>{t.name}</span>
                      {t.statusLabel && <span className="rounded bg-panel2 px-1.5 text-xs text-muted ring-1 ring-line">{t.statusLabel}</span>}
                      <span className="text-xs text-dim">사건 {t.incidentCount}</span>
                      <span className="w-12 text-right font-mono font-bold">{t.score}</span>
                    </div>
                    <div className="ml-7 h-2 overflow-hidden rounded bg-panel2">
                      <div className="h-full rounded" style={{ width: `${Math.max(2, (t.score / maxScore) * 100)}%`, background: t.color }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {typeCounts.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <div className="panel-head mb-2">사건 유형</div>
              <div className="flex flex-wrap gap-2">
                {typeCounts.map(([type, n]) => (
                  <span key={type} className="rounded bg-panel2 px-2 py-1 text-sm ring-1 ring-line">
                    {INCIDENT_TYPE_LABEL[type as IncidentType]} <span className="font-mono font-bold">{n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <Timeline title="확인 완료 사건" tone="border-ok/40" items={confirmed} empty="확인 완료된 사건이 없습니다." />
          <Timeline title="확인 중 · 미확인 사건" tone="border-warn/40" items={unconfirmed} empty="확인 중인 사건이 없습니다." />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="panel p-4">
      <div className="panel-head">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

function Timeline({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: string;
  items: Awaited<ReturnType<typeof getWarRoom>>["incidents"];
  empty: string;
}) {
  return (
    <div className={`panel p-4 ${tone}`}>
      <div className="panel-head mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="relative ml-2 border-l border-line">
          {items.map((i) => (
            <li key={i.id} className="mb-4 ml-4">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-bg bg-line" />
              <div className="font-mono text-xs text-dim">{fmtDateTime(i.occurredAt ?? i.createdAt)}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <TypeBadge type={i.type} />
                <VerificationBadge status={i.verificationStatus} />
              </div>
              <div className="mt-1 font-semibold">{i.title}</div>
              {i.summary && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{i.summary}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {i.teams.map((t) => (
                  <TeamChip key={t.teamId} name={t.name} color={t.color} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
