import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  articleClips,
  articles,
  breakingNews,
  clips,
  episodes,
  events,
  incidents,
  incidentTeams,
  players,
  pollOptions,
  polls,
  pollVotes,
  reportMedia,
  reports,
  reportTeams,
  rundownItems,
  teamMembers,
  teams,
} from "@/db/schema";
import { mediaUrl } from "@/lib/media";
import { articleVisible, breakingPublished, clipVisible, incidentVisible, reportVisible } from "./visibility";

/* ---------------------------- 기사 ---------------------------- */

const articleCard = {
  id: articles.id,
  title: articles.title,
  lead: articles.lead,
  coverUrl: articles.coverUrl,
  publishedAt: articles.publishedAt,
  verificationStatus: articles.verificationStatus,
  isFeatured: articles.isFeatured,
  incidentId: articles.incidentId,
};

export async function listArticles(db: DB, opts: { limit?: number; offset?: number; featured?: boolean } = {}) {
  return db
    .select(articleCard)
    .from(articles)
    .where(opts.featured ? and(articleVisible, eq(articles.isFeatured, true)) : articleVisible)
    .orderBy(desc(articles.publishedAt))
    .limit(opts.limit ?? 20)
    .offset(opts.offset ?? 0);
}

export async function countArticles(db: DB) {
  const [r] = await db.select({ n: count() }).from(articles).where(articleVisible);
  return r.n;
}

export async function getPublicArticle(db: DB, id: string) {
  const [a] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), articleVisible));
  if (!a) return null;
  const [incident] = a.incidentId
    ? await db.select().from(incidents).where(and(eq(incidents.id, a.incidentId), incidentVisible))
    : [];
  const linkedClips = await db
    .select({ clip: clips })
    .from(articleClips)
    .innerJoin(clips, eq(clips.id, articleClips.clipId))
    .where(and(eq(articleClips.articleId, a.id), clipVisible))
    .orderBy(asc(articleClips.position));
  const related = a.incidentId
    ? await db
        .select(articleCard)
        .from(articles)
        .where(and(articleVisible, eq(articles.incidentId, a.incidentId), ne(articles.id, a.id)))
        .orderBy(desc(articles.publishedAt))
        .limit(5)
    : [];
  const [source] = a.sourceBreakingId
    ? await db
        .select({ id: breakingNews.id, title: breakingNews.title, startsAt: breakingNews.startsAt })
        .from(breakingNews)
        .where(and(eq(breakingNews.id, a.sourceBreakingId), breakingPublished))
    : [];
  const incidentTeamsRows = incident
    ? await db
        .select({ id: teams.id, name: teams.name, color: teams.color })
        .from(incidentTeams)
        .innerJoin(teams, eq(teams.id, incidentTeams.teamId))
        .where(and(eq(incidentTeams.incidentId, incident.id), eq(teams.isPublic, true)))
    : [];
  return { article: a, incident: incident ?? null, clips: linkedClips.map((c) => c.clip), related, source: source ?? null, teams: incidentTeamsRows };
}

/* ---------------------------- 속보 ---------------------------- */

export async function listBreakingHistory(db: DB, limit = 50) {
  return db
    .select()
    .from(breakingNews)
    .where(breakingPublished)
    .orderBy(desc(breakingNews.startsAt))
    .limit(limit);
}

/* ---------------------------- 제보 ---------------------------- */

export type PublicReport = {
  id: string;
  type: string;
  title: string;
  body: string;
  occurredAt: Date | null;
  createdAt: Date;
  reporter: string;
  status: string;
  isSensitive: boolean;
  images: string[];
  videoUrl: string | null;
  teams: { id: string; name: string; color: string }[];
};

/** 공개용 제보 변환: 익명 제보자 비식별, 민감 제보는 공개 요약만 노출 */
export async function listPublicReports(db: DB, limit = 30): Promise<PublicReport[]> {
  const rows = await db.select().from(reports).where(reportVisible).orderBy(desc(reports.reviewedAt), desc(reports.createdAt)).limit(limit);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [media, teamRows] = await Promise.all([
    db.select({ reportId: reportMedia.reportId, mediaId: reportMedia.mediaId }).from(reportMedia).where(inArray(reportMedia.reportId, ids)).orderBy(asc(reportMedia.position)),
    db
      .select({ reportId: reportTeams.reportId, id: teams.id, name: teams.name, color: teams.color })
      .from(reportTeams)
      .innerJoin(teams, eq(teams.id, reportTeams.teamId))
      .where(and(inArray(reportTeams.reportId, ids), eq(teams.isPublic, true))),
  ]);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.isSensitive ? (r.publicSummary ?? "민감 정보가 포함되어 요약만 공개됩니다.") : r.body,
    occurredAt: r.occurredAt,
    createdAt: r.createdAt,
    reporter: r.isAnonymous || !r.nickname ? "익명 제보자" : r.nickname,
    status: r.status,
    isSensitive: r.isSensitive,
    images: r.isSensitive ? [] : media.filter((m) => m.reportId === r.id).map((m) => mediaUrl(m.mediaId)),
    videoUrl: r.isSensitive ? null : r.videoUrl,
    teams: teamRows.filter((t) => t.reportId === r.id).map(({ id, name, color }) => ({ id, name, color })),
  }));
}

/* ---------------------------- 클립 ---------------------------- */

export async function listPublicClips(db: DB, opts: { hotOnly?: boolean; limit?: number } = {}) {
  return db
    .select({
      clip: clips,
      teamName: teams.name,
      teamColor: teams.color,
      playerName: players.nickname,
    })
    .from(clips)
    .leftJoin(teams, eq(teams.id, clips.teamId))
    .leftJoin(players, eq(players.id, clips.playerId))
    .where(opts.hotOnly ? and(clipVisible, eq(clips.isHot, true)) : clipVisible)
    .orderBy(desc(clips.isHot), desc(clips.reviewedAt), desc(clips.createdAt))
    .limit(opts.limit ?? 40);
}

/* ---------------------------- 팀 · 상황판 ---------------------------- */

export async function getActiveEvent(db: DB) {
  const [ev] = await db.select().from(events).where(eq(events.isActive, true)).orderBy(desc(events.createdAt)).limit(1);
  return ev ?? null;
}

export async function listEventsWithTeams(db: DB) {
  const evs = await db.select().from(events).orderBy(desc(events.isActive), desc(events.startsAt), desc(events.createdAt));
  const teamRows = await db.select().from(teams).where(eq(teams.isPublic, true)).orderBy(desc(teams.score), asc(teams.name));
  const memberCounts = await db
    .select({ teamId: teamMembers.teamId, n: count() })
    .from(teamMembers)
    .where(isNull(teamMembers.leftAt))
    .groupBy(teamMembers.teamId);
  return evs
    .map((ev) => ({
      event: ev,
      teams: teamRows
        .filter((t) => t.eventId === ev.id)
        .map((t) => ({ ...t, memberCount: memberCounts.find((m) => m.teamId === t.id)?.n ?? 0 })),
    }))
    .filter((e) => e.teams.length > 0);
}

export async function getPublicTeam(db: DB, id: string) {
  const [team] = await db.select().from(teams).where(and(eq(teams.id, id), eq(teams.isPublic, true)));
  if (!team) return null;
  const [ev] = await db.select().from(events).where(eq(events.id, team.eventId));
  const members = await db
    .select({ member: teamMembers, player: players })
    .from(teamMembers)
    .innerJoin(players, eq(players.id, teamMembers.playerId))
    .where(eq(teamMembers.teamId, id))
    .orderBy(asc(teamMembers.leftAt), asc(players.nickname));
  const incidentRows = await db
    .select({ incident: incidents })
    .from(incidentTeams)
    .innerJoin(incidents, eq(incidents.id, incidentTeams.incidentId))
    .where(and(eq(incidentTeams.teamId, id), incidentVisible))
    .orderBy(desc(incidents.occurredAt))
    .limit(20);
  const incidentIds = incidentRows.map((r) => r.incident.id);
  const news = incidentIds.length
    ? await db.select(articleCard).from(articles).where(and(articleVisible, inArray(articles.incidentId, incidentIds))).orderBy(desc(articles.publishedAt)).limit(10)
    : [];
  return { team, event: ev ?? null, members, incidents: incidentRows.map((r) => r.incident), news };
}

export async function getWarRoom(db: DB) {
  const ev = await getActiveEvent(db);
  const teamRows = ev
    ? await db.select().from(teams).where(and(eq(teams.eventId, ev.id), eq(teams.isPublic, true))).orderBy(desc(teams.score), asc(teams.name))
    : [];
  const incidentRows = await db
    .select()
    .from(incidents)
    .where(ev ? and(incidentVisible, or(eq(incidents.eventId, ev.id), isNull(incidents.eventId))) : incidentVisible)
    .orderBy(sql`${incidents.occurredAt} desc nulls last`, desc(incidents.createdAt))
    .limit(40);
  const links = incidentRows.length
    ? await db
        .select({ incidentId: incidentTeams.incidentId, teamId: incidentTeams.teamId, name: teams.name, color: teams.color })
        .from(incidentTeams)
        .innerJoin(teams, eq(teams.id, incidentTeams.teamId))
        .where(and(inArray(incidentTeams.incidentId, incidentRows.map((i) => i.id)), eq(teams.isPublic, true)))
    : [];
  const withTeams = incidentRows.map((i) => ({ ...i, teams: links.filter((l) => l.incidentId === i.id) }));
  const teamStats = teamRows.map((t) => ({
    ...t,
    incidentCount: links.filter((l) => l.teamId === t.id).length,
  }));
  return { event: ev, teams: teamStats, incidents: withTeams };
}

/* ---------------------------- 투표 ---------------------------- */

export async function listPublicPolls(db: DB) {
  const rows = await db
    .select()
    .from(polls)
    .where(inArray(polls.status, ["OPEN", "CLOSED"]))
    .orderBy(sql`case when ${polls.status} = 'OPEN' then 0 else 1 end`, desc(polls.createdAt))
    .limit(30);
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const opts = await db.select().from(pollOptions).where(inArray(pollOptions.pollId, ids)).orderBy(asc(pollOptions.position));
  const counts = await db
    .select({ optionId: pollVotes.optionId, n: count() })
    .from(pollVotes)
    .where(inArray(pollVotes.pollId, ids))
    .groupBy(pollVotes.optionId);
  return rows.map((p) => ({
    poll: p,
    options: opts.filter((o) => o.pollId === p.id).map((o) => ({ ...o, votes: counts.find((c) => c.optionId === o.id)?.n ?? 0 })),
  }));
}

/* ---------------------------- 아카이브 ---------------------------- */

export async function listArchive(db: DB) {
  const eps = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.status, "ENDED"), eq(episodes.isPublic, true), lte(episodes.endedAt, sql`now()`)))
    .orderBy(desc(episodes.endedAt))
    .limit(50);
  if (!eps.length) return [];
  const items = await db
    .select({ episodeId: rundownItems.episodeId, title: rundownItems.title, kind: rundownItems.kind, articleId: articles.id, articleVisible: sql<boolean>`${articleVisible}` })
    .from(rundownItems)
    .leftJoin(articles, eq(articles.id, rundownItems.articleId))
    .where(and(inArray(rundownItems.episodeId, eps.map((e) => e.id)), ne(rundownItems.status, "SKIPPED")))
    .orderBy(asc(rundownItems.position));
  return eps.map((e) => ({
    episode: e,
    items: items
      .filter((i) => i.episodeId === e.id)
      .map((i) => ({ title: i.title, kind: i.kind, articleId: i.articleVisible ? i.articleId : null })),
  }));
}

export async function getOnAirEpisode(db: DB) {
  const [ep] = await db.select().from(episodes).where(eq(episodes.status, "LIVE")).limit(1);
  return ep ?? null;
}
