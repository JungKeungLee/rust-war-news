import "server-only";
import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  articles,
  breakingNews,
  clips,
  contentFlags,
  episodeAnchors,
  episodes,
  events,
  incidents,
  overlayStates,
  reports,
  roles,
  rundownItems,
  rundownScripts,
  teams,
  userRoles,
  users,
} from "@/db/schema";
import { breakingActive } from "./visibility";

/** 선택 목록용 조회 (관리자 폼) */
export async function getLookups(db: DB) {
  const [incidentList, teamList, eventList, anchorList, articleList, clipList] = await Promise.all([
    db
      .select({ id: incidents.id, title: incidents.title, verificationStatus: incidents.verificationStatus, isClosed: incidents.isClosed })
      .from(incidents)
      .orderBy(asc(incidents.isClosed), desc(incidents.createdAt))
      .limit(200),
    db
      .select({ id: teams.id, name: teams.name, color: teams.color, eventId: teams.eventId, eventName: events.name })
      .from(teams)
      .innerJoin(events, eq(events.id, teams.eventId))
      .orderBy(desc(events.isActive), asc(teams.name)),
    db.select({ id: events.id, name: events.name, isActive: events.isActive }).from(events).orderBy(desc(events.isActive), desc(events.createdAt)),
    listAnchors(db),
    db.select({ id: articles.id, title: articles.title, status: articles.status }).from(articles).orderBy(desc(articles.updatedAt)).limit(200),
    db
      .select({ id: clips.id, title: clips.title, url: clips.url, status: clips.status })
      .from(clips)
      .where(ne(clips.status, "REJECTED"))
      .orderBy(desc(clips.createdAt))
      .limit(200),
  ]);
  return { incidents: incidentList, teams: teamList, events: eventList, anchors: anchorList, articles: articleList, clips: clipList };
}

export type Lookups = Awaited<ReturnType<typeof getLookups>>;

/** 진행자 = ANCHOR 역할을 가진 활성 사용자 (하드코딩 없이 계정과 연결) */
export async function listAnchors(db: DB) {
  return db
    .select({ id: users.id, displayName: users.displayName, color: users.color })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.code, "ANCHOR"), eq(users.isActive, true)))
    .orderBy(asc(users.displayName));
}

export async function getEpisodeFull(db: DB, id: string) {
  const [episode] = await db.select().from(episodes).where(eq(episodes.id, id));
  if (!episode) return null;
  const items = await db
    .select({
      item: rundownItems,
      articleTitle: articles.title,
      articleStatus: articles.status,
      clipTitle: clips.title,
      clipUrl: clips.url,
      clipEmbedUrl: clips.embedUrl,
      anchorName: users.displayName,
      anchorColor: users.color,
    })
    .from(rundownItems)
    .leftJoin(articles, eq(articles.id, rundownItems.articleId))
    .leftJoin(clips, eq(clips.id, rundownItems.clipId))
    .leftJoin(users, eq(users.id, rundownItems.anchorId))
    .where(eq(rundownItems.episodeId, id))
    .orderBy(asc(rundownItems.position));
  const scripts = items.length
    ? await db.select().from(rundownScripts).where(inArray(rundownScripts.rundownItemId, items.map((i) => i.item.id)))
    : [];
  const anchors = await db
    .select({ id: users.id, displayName: users.displayName, color: users.color })
    .from(episodeAnchors)
    .innerJoin(users, eq(users.id, episodeAnchors.userId))
    .where(eq(episodeAnchors.episodeId, id))
    .orderBy(asc(episodeAnchors.position));
  return {
    episode,
    anchors,
    items: items.map((r) => ({
      ...r.item,
      articleTitle: r.articleTitle,
      articleStatus: r.articleStatus,
      clipTitle: r.clipTitle,
      clipUrl: r.clipUrl,
      clipEmbedUrl: r.clipEmbedUrl,
      anchorName: r.anchorName,
      anchorColor: r.anchorColor,
      scripts: scripts.filter((s) => s.rundownItemId === r.item.id),
    })),
  };
}

export type EpisodeFull = NonNullable<Awaited<ReturnType<typeof getEpisodeFull>>>;

/** 방송 지통실 스냅샷 */
export async function getControlRoomSnapshot(db: DB) {
  const [reportCounts, pendingReports, openIncidents, liveBreaking, latestArticles, overlays, hotClips, flags] = await Promise.all([
    db.select({ status: reports.status, n: count() }).from(reports).groupBy(reports.status),
    db
      .select({ id: reports.id, title: reports.title, type: reports.type, status: reports.status, createdAt: reports.createdAt, incidentId: reports.incidentId, version: reports.version, isSensitive: reports.isSensitive })
      .from(reports)
      .where(inArray(reports.status, ["RECEIVED", "REVIEWING"]))
      .orderBy(desc(reports.createdAt))
      .limit(10),
    db
      .select({ id: incidents.id, title: incidents.title, type: incidents.type, verificationStatus: incidents.verificationStatus, isPublic: incidents.isPublic, updatedAt: incidents.updatedAt })
      .from(incidents)
      .where(eq(incidents.isClosed, false))
      .orderBy(desc(incidents.updatedAt))
      .limit(10),
    db.select().from(breakingNews).where(breakingActive).orderBy(desc(breakingNews.isPinned), desc(breakingNews.startsAt)),
    db
      .select({ id: articles.id, title: articles.title, status: articles.status, updatedAt: articles.updatedAt })
      .from(articles)
      .orderBy(desc(articles.updatedAt))
      .limit(8),
    db.select().from(overlayStates).orderBy(asc(overlayStates.key)),
    db
      .select({ id: clips.id, title: clips.title, url: clips.url, embedUrl: clips.embedUrl, isHot: clips.isHot })
      .from(clips)
      .where(eq(clips.status, "APPROVED"))
      .orderBy(desc(clips.isHot), desc(clips.reviewedAt))
      .limit(8),
    db.select({ n: count() }).from(contentFlags).where(eq(contentFlags.status, "OPEN")),
  ]);

  const [liveEpisode] = await db.select().from(episodes).where(eq(episodes.status, "LIVE")).limit(1);
  const [nextEpisode] = liveEpisode
    ? [liveEpisode]
    : await db
        .select()
        .from(episodes)
        .where(inArray(episodes.status, ["PLANNED", "READY"]))
        .orderBy(sql`${episodes.scheduledAt} asc nulls last`)
        .limit(1);
  const episode = nextEpisode ? await getEpisodeFull(db, nextEpisode.id) : null;

  const by = (s: string) => reportCounts.find((r) => r.status === s)?.n ?? 0;
  return {
    serverTime: new Date().toISOString(),
    stats: {
      reportsReceived: by("RECEIVED"),
      reportsReviewing: by("REVIEWING"),
      reportsTotal: reportCounts.reduce((s, r) => s + r.n, 0),
      openIncidents: openIncidents.length,
      liveBreaking: liveBreaking.length,
      openFlags: flags[0]?.n ?? 0,
    },
    pendingReports,
    openIncidents,
    liveBreaking,
    latestArticles,
    overlays,
    hotClips,
    episode,
  };
}

export type ControlRoomSnapshot = Awaited<ReturnType<typeof getControlRoomSnapshot>>;

export async function countPending(db: DB) {
  const [[r], [c], [f]] = await Promise.all([
    db.select({ n: count() }).from(reports).where(inArray(reports.status, ["RECEIVED", "REVIEWING"])),
    db.select({ n: count() }).from(clips).where(eq(clips.status, "PENDING")),
    db.select({ n: count() }).from(contentFlags).where(eq(contentFlags.status, "OPEN")),
  ]);
  return { reports: r.n, clips: c.n, flags: f.n };
}

