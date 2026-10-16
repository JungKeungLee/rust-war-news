import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { articles, breakingNews, clips, events, incidents, incidentTeams, players, teamMembers, teams } from "@/db/schema";
import { detectBroadcastPlatform, BROADCAST_PLATFORM_LABEL } from "@/lib/broadcast";
import { HOSTILE_INCIDENT_TYPES, type IncidentType, type TeamStatus } from "@/lib/labels";
import { articleVisible, breakingActive, breakingPublished, clipVisible, incidentVisible } from "./visibility";

/**
 * 공개 지통실 데이터.
 * 모든 공개 여부 판단은 이 서버 조회 단계에서 수행한다 (visibility.ts 의 공통 조건 사용).
 *  - 팀: is_public 팀만
 *  - 팀 상태: status_is_public 일 때만 실제 값, 아니면 UNKNOWN
 *  - 사건: 공개 + 공개 가능 시각 도달 (incidentVisible)
 *  - 속보: 한 번이라도 송출된 것, 팀 연결은 "공개된 사건"을 통해서만
 *  - 기사: 발행된 것, 클립: 승인된 것
 * 승인 전 제보·관리자 메모·제보자 정보·이메일 등은 조회 자체를 하지 않는다.
 */

type TeamRow = typeof teams.$inferSelect;

function publicTeamStatus(t: TeamRow) {
  return t.statusIsPublic
    ? { status: t.publicStatus as TeamStatus, message: t.statusMessage, updatedAt: t.statusUpdatedAt?.toISOString() ?? null }
    : { status: "UNKNOWN" as TeamStatus, message: null, updatedAt: null };
}

const maxIso = (...ds: (Date | string | null | undefined)[]) => {
  const ts = ds.filter(Boolean).map((d) => new Date(d as Date).getTime());
  return ts.length ? new Date(Math.max(...ts)).toISOString() : null;
};

async function activeEventOrNull(db: DB) {
  const [ev] = await db.select().from(events).where(eq(events.isActive, true)).orderBy(desc(events.createdAt)).limit(1);
  return ev ?? null;
}

/** 공개 사건 → 연결된 공개 팀 목록 */
async function teamsOfIncidents(db: DB, incidentIds: string[]) {
  if (!incidentIds.length) return [];
  return db
    .select({ incidentId: incidentTeams.incidentId, id: teams.id, name: teams.name, color: teams.color })
    .from(incidentTeams)
    .innerJoin(teams, eq(teams.id, incidentTeams.teamId))
    .where(and(inArray(incidentTeams.incidentId, incidentIds), eq(teams.isPublic, true)));
}

const incidentCols = {
  id: incidents.id,
  title: incidents.title,
  type: incidents.type,
  summary: incidents.summary,
  occurredAt: incidents.occurredAt,
  verificationStatus: incidents.verificationStatus,
  isClosed: incidents.isClosed,
  createdAt: incidents.createdAt,
  updatedAt: incidents.updatedAt,
};

/* ------------------------------------------------------------------ */
/* 종합 지통실                                                          */
/* ------------------------------------------------------------------ */

export async function getControlRoomOverview(db: DB) {
  const ev = await activeEventOrNull(db);
  const teamRows = await db
    .select()
    .from(teams)
    .where(ev ? and(eq(teams.isPublic, true), eq(teams.eventId, ev.id)) : eq(teams.isPublic, true))
    .orderBy(asc(teams.name));
  const teamIds = teamRows.map((t) => t.id);

  const [memberCounts, teamIncidents, recentIncidents, latestArticles, hotClips, activeBreaking] = await Promise.all([
    teamIds.length
      ? db
          .select({ teamId: teamMembers.teamId, n: count() })
          .from(teamMembers)
          .where(and(inArray(teamMembers.teamId, teamIds), isNull(teamMembers.leftAt)))
          .groupBy(teamMembers.teamId)
      : [],
    // 팀별 최신 공개 사건 (팀당 최신 1건은 아래에서 고름)
    teamIds.length
      ? db
          .select({ teamId: incidentTeams.teamId, ...incidentCols })
          .from(incidentTeams)
          .innerJoin(incidents, eq(incidents.id, incidentTeams.incidentId))
          .where(and(inArray(incidentTeams.teamId, teamIds), incidentVisible))
          .orderBy(sql`coalesce(${incidents.occurredAt}, ${incidents.createdAt}) desc`)
          .limit(500)
      : [],
    db
      .select(incidentCols)
      .from(incidents)
      .where(incidentVisible)
      .orderBy(sql`coalesce(${incidents.occurredAt}, ${incidents.createdAt}) desc`)
      .limit(15),
    db
      .select({ id: articles.id, title: articles.title, lead: articles.lead, coverUrl: articles.coverUrl, publishedAt: articles.publishedAt, verificationStatus: articles.verificationStatus })
      .from(articles)
      .where(articleVisible)
      .orderBy(desc(articles.publishedAt))
      .limit(6),
    db
      .select({ id: clips.id, title: clips.title, url: clips.url, thumbnailUrl: clips.thumbnailUrl, platform: clips.platform, isHot: clips.isHot, teamId: clips.teamId })
      .from(clips)
      .where(clipVisible)
      .orderBy(desc(clips.isHot), desc(clips.reviewedAt))
      .limit(4),
    db
      .select({ id: breakingNews.id, title: breakingNews.title, priority: breakingNews.priority, verificationStatus: breakingNews.verificationStatus, startsAt: breakingNews.startsAt, incidentId: breakingNews.incidentId })
      .from(breakingNews)
      .where(breakingActive)
      .orderBy(desc(breakingNews.isPinned), sql`case when ${breakingNews.priority} = 'URGENT' then 0 else 1 end`, desc(breakingNews.startsAt))
      .limit(10),
  ]);

  const [openCount] = await db.select({ n: count() }).from(incidents).where(and(incidentVisible, eq(incidents.isClosed, false)));
  const timelineTeams = await teamsOfIncidents(db, recentIncidents.map((i) => i.id));
  const dayAgo = Date.now() - 24 * 3600 * 1000;

  const teamCards = teamRows.map((t) => {
    const inc = teamIncidents.filter((i) => i.teamId === t.id);
    const latest = inc[0] ?? null;
    const st = publicTeamStatus(t);
    const recent24h = inc.filter((i) => new Date(i.occurredAt ?? i.createdAt).getTime() > dayAgo).length;
    return {
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      logoUrl: t.logoUrl,
      description: t.description ? t.description.slice(0, 120) : null,
      isEliminated: t.isEliminated,
      memberCount: memberCounts.find((m) => m.teamId === t.id)?.n ?? 0,
      status: st.status,
      statusMessage: st.message,
      incidentCount: inc.length,
      recentIncidentCount: recent24h,
      latestIncident: latest
        ? { id: latest.id, title: latest.title, type: latest.type, verificationStatus: latest.verificationStatus, at: (latest.occurredAt ?? latest.createdAt).toISOString() }
        : null,
      updatedAt: maxIso(st.updatedAt, latest?.updatedAt, t.updatedAt),
      statusUpdatedAt: st.updatedAt,
    };
  });

  const playerCount = teamCards.reduce((s, t) => s + t.memberCount, 0);
  return {
    serverTime: new Date().toISOString(),
    event: ev ? { id: ev.id, name: ev.name, season: ev.season } : null,
    stats: {
      teamCount: teamCards.length,
      playerCount,
      openIncidentCount: openCount.n,
      urgentBreakingCount: activeBreaking.filter((b) => b.priority === "URGENT").length,
    },
    lastPublicUpdate: maxIso(...teamCards.map((t) => t.updatedAt), ...recentIncidents.map((i) => i.updatedAt), ...activeBreaking.map((b) => b.startsAt)),
    teams: teamCards,
    timeline: recentIncidents.map((i) => ({
      id: i.id,
      title: i.title,
      type: i.type,
      summary: i.summary,
      verificationStatus: i.verificationStatus,
      at: (i.occurredAt ?? i.createdAt).toISOString(),
      teams: timelineTeams.filter((x) => x.incidentId === i.id).map(({ id, name, color }) => ({ id, name, color })),
    })),
    articles: latestArticles.map((a) => ({ ...a, publishedAt: a.publishedAt?.toISOString() ?? null })),
    clips: hotClips,
    breaking: activeBreaking.map((b) => ({ ...b, startsAt: b.startsAt?.toISOString() ?? null, incidentId: undefined })),
  };
}

export type ControlRoomOverview = Awaited<ReturnType<typeof getControlRoomOverview>>;

/* ------------------------------------------------------------------ */
/* 팀별 지통실                                                          */
/* ------------------------------------------------------------------ */

export async function getTeamControlRoom(db: DB, teamId: string) {
  const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.isPublic, true)));
  if (!team) return null;
  const [ev] = await db.select({ id: events.id, name: events.name, season: events.season, isActive: events.isActive }).from(events).where(eq(events.id, team.eventId));

  // 이 팀과 연결된 "공개" 사건 (여러 팀 사건은 연결된 모든 팀에 표시)
  const teamIncidents = await db
    .select(incidentCols)
    .from(incidentTeams)
    .innerJoin(incidents, eq(incidents.id, incidentTeams.incidentId))
    .where(and(eq(incidentTeams.teamId, teamId), incidentVisible))
    .orderBy(sql`coalesce(${incidents.occurredAt}, ${incidents.createdAt}) desc`)
    .limit(50);
  const incIds = teamIncidents.map((i) => i.id);

  const [members, incTeams, incArticles, breakingRows, newsRows, clipRows] = await Promise.all([
    db
      .select({ id: teamMembers.id, role: teamMembers.role, nickname: players.nickname, profile: players.profile, avatarUrl: players.avatarUrl, streamUrl: players.streamUrl, playerId: players.id })
      .from(teamMembers)
      .innerJoin(players, eq(players.id, teamMembers.playerId))
      .where(and(eq(teamMembers.teamId, teamId), isNull(teamMembers.leftAt)))
      .orderBy(asc(players.nickname)),
    teamsOfIncidents(db, incIds),
    incIds.length
      ? db
          .select({ id: articles.id, title: articles.title, incidentId: articles.incidentId })
          .from(articles)
          .where(and(articleVisible, inArray(articles.incidentId, incIds)))
          .orderBy(desc(articles.publishedAt))
      : [],
    incIds.length
      ? db
          .select({
            id: breakingNews.id,
            title: breakingNews.title,
            priority: breakingNews.priority,
            verificationStatus: breakingNews.verificationStatus,
            status: breakingNews.status,
            startsAt: breakingNews.startsAt,
            endsAt: breakingNews.endsAt,
            correctedAt: breakingNews.correctedAt,
            incidentId: breakingNews.incidentId,
            convertedArticleId: breakingNews.convertedArticleId,
            active: sql<boolean>`${breakingActive}`,
          })
          .from(breakingNews)
          .where(and(breakingPublished, inArray(breakingNews.incidentId, incIds)))
          .orderBy(desc(breakingNews.startsAt))
          .limit(20)
      : [],
    incIds.length
      ? db
          .select({ id: articles.id, title: articles.title, lead: articles.lead, coverUrl: articles.coverUrl, publishedAt: articles.publishedAt, verificationStatus: articles.verificationStatus })
          .from(articles)
          .where(and(articleVisible, inArray(articles.incidentId, incIds)))
          .orderBy(desc(articles.publishedAt))
          .limit(12)
      : [],
    db
      .select({ id: clips.id, title: clips.title, url: clips.url, thumbnailUrl: clips.thumbnailUrl, platform: clips.platform, embedUrl: clips.embedUrl, isHot: clips.isHot, playerName: players.nickname })
      .from(clips)
      .leftJoin(players, eq(players.id, clips.playerId))
      .where(and(clipVisible, incIds.length ? or(eq(clips.teamId, teamId), inArray(clips.incidentId, incIds)) : eq(clips.teamId, teamId)))
      .orderBy(desc(clips.isHot), desc(clips.reviewedAt))
      .limit(12),
  ]);

  // 기사 전환 링크는 해당 기사가 발행된 경우에만
  const convertedIds = breakingRows.map((b) => b.convertedArticleId).filter((x): x is string => !!x);
  const publishedConverted = convertedIds.length
    ? new Set((await db.select({ id: articles.id }).from(articles).where(and(articleVisible, inArray(articles.id, convertedIds)))).map((a) => a.id))
    : new Set<string>();

  // 관련 팀: 공개 사건으로 연결된 다른 공개 팀. 교전 상대 / 확인된 동맹(확인 완료 동맹 사건만)
  const related = new Map<string, { id: string; name: string; color: string; hostile: number; alliedConfirmed: number; lastAt: string; incidentIds: string[] }>();
  for (const inc of teamIncidents) {
    const at = (inc.occurredAt ?? inc.createdAt).toISOString();
    for (const other of incTeams.filter((x) => x.incidentId === inc.id && x.id !== teamId)) {
      const r = related.get(other.id) ?? { id: other.id, name: other.name, color: other.color, hostile: 0, alliedConfirmed: 0, lastAt: at, incidentIds: [] };
      if (HOSTILE_INCIDENT_TYPES.includes(inc.type as IncidentType)) r.hostile += 1;
      if (inc.type === "ALLIANCE" && inc.verificationStatus === "CONFIRMED") r.alliedConfirmed += 1;
      if (at > r.lastAt) r.lastAt = at;
      r.incidentIds.push(inc.id);
      related.set(other.id, r);
    }
  }

  const st = publicTeamStatus(team);
  const [statusIncident] = team.statusIsPublic && team.statusIncidentId
    ? await db.select({ id: incidents.id, title: incidents.title }).from(incidents).where(and(eq(incidents.id, team.statusIncidentId), incidentVisible))
    : [];
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const incTitle = new Map(teamIncidents.map((i) => [i.id, i.title]));

  return {
    serverTime: new Date().toISOString(),
    team: {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      color: team.color,
      logoUrl: team.logoUrl,
      description: team.description,
      isEliminated: team.isEliminated,
      score: team.score,
      event: ev ?? null,
      memberCount: members.length,
    },
    status: {
      ...st,
      incident: statusIncident ?? null,
      recentIncidentCount: teamIncidents.filter((i) => new Date(i.occurredAt ?? i.createdAt).getTime() > dayAgo).length,
      incidentCount: teamIncidents.length,
      breakingCount: breakingRows.length,
      activeBreakingCount: breakingRows.filter((b) => b.active).length,
    },
    lastPublicUpdate: maxIso(st.updatedAt, team.updatedAt, ...teamIncidents.map((i) => i.updatedAt), ...breakingRows.map((b) => b.startsAt)),
    players: members.map((m) => {
      const platform = m.streamUrl ? detectBroadcastPlatform(m.streamUrl) : null;
      return {
        id: m.id,
        nickname: m.nickname,
        role: m.role,
        profile: m.profile,
        avatarUrl: m.avatarUrl,
        streamUrl: m.streamUrl,
        platform: platform ? BROADCAST_PLATFORM_LABEL[platform] : null,
        // 외부 플랫폼 방송 여부는 연동하지 않으므로 항상 "확인 안 됨"
        streamStatus: "UNVERIFIED" as const,
      };
    }),
    breaking: breakingRows.map((b) => ({
      id: b.id,
      title: b.title,
      priority: b.priority,
      verificationStatus: b.verificationStatus,
      active: !!b.active,
      ended: b.status === "ENDED" || b.status === "CANCELLED" || !b.active,
      corrected: !!b.correctedAt,
      at: b.startsAt?.toISOString() ?? null,
      incident: b.incidentId ? { id: b.incidentId, title: incTitle.get(b.incidentId) ?? null } : null,
      articleId: b.convertedArticleId && publishedConverted.has(b.convertedArticleId) ? b.convertedArticleId : null,
    })),
    incidents: teamIncidents.map((i) => ({
      id: i.id,
      title: i.title,
      type: i.type,
      summary: i.summary,
      verificationStatus: i.verificationStatus,
      isClosed: i.isClosed,
      at: (i.occurredAt ?? i.createdAt).toISOString(),
      teams: incTeams.filter((x) => x.incidentId === i.id).map(({ id, name, color }) => ({ id, name, color })),
      articles: incArticles.filter((a) => a.incidentId === i.id).map(({ id, title }) => ({ id, title })),
    })),
    news: newsRows.map((a) => ({ ...a, publishedAt: a.publishedAt?.toISOString() ?? null })),
    clips: clipRows,
    relatedTeams: [...related.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
  };
}

export type TeamControlRoom = NonNullable<Awaited<ReturnType<typeof getTeamControlRoom>>>;

