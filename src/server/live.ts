import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { articles, breakingNews, episodes, events, overlayStates, rundownItems, teams, users } from "@/db/schema";
import type { OverlayKey } from "@/lib/labels";
import type { LiveBreaking, OverlayState, PublicLiveState } from "@/lib/live/types";
import { getSettings } from "./settings";
import { articleVisible, breakingActive } from "./visibility";

/**
 * 실시간 상태 조회 계층.
 * 현재는 클라이언트가 3~5초마다 폴링한다. 외부 실시간 메시징(Pusher/Ably 등)으로 바꿀 때는
 * 상태 변경 지점에서 이 함수 결과를 publish 하고 클라이언트 transport 만 교체하면 된다.
 */
export async function getActiveBreaking(db: DB): Promise<LiveBreaking[]> {
  const rows = await db
    .select()
    .from(breakingNews)
    .where(breakingActive)
    .orderBy(desc(breakingNews.isPinned), sql`case when ${breakingNews.priority} = 'URGENT' then 0 else 1 end`, desc(breakingNews.startsAt))
    .limit(20);
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    priority: b.priority,
    verificationStatus: b.verificationStatus,
    isPinned: b.isPinned,
    showOnOverlay: b.showOnOverlay,
    startsAt: b.startsAt?.toISOString() ?? null,
    correctedAt: b.correctedAt?.toISOString() ?? null,
    correctionNote: b.correctionNote,
    incidentId: b.incidentId,
  }));
}

export async function getPublicLiveState(db: DB): Promise<PublicLiveState> {
  const [settings, breaking] = await Promise.all([getSettings(db), getActiveBreaking(db)]);
  return {
    serverTime: new Date().toISOString(),
    live: settings.live,
    notice: settings.notice.text,
    breaking,
  };
}

async function getLiveEpisodeContext(db: DB) {
  const [ep] = await db.select().from(episodes).where(eq(episodes.status, "LIVE")).orderBy(desc(episodes.startedAt)).limit(1);
  if (!ep) return { episode: null, item: null };
  let itemRow: { title: string; lead: string | null; anchorName: string | null; anchorColor: string | null; kind: string } | null = null;
  const where = ep.currentItemId
    ? eq(rundownItems.id, ep.currentItemId)
    : and(eq(rundownItems.episodeId, ep.id), eq(rundownItems.status, "ON_AIR"));
  const [row] = await db
    .select({ title: rundownItems.title, kind: rundownItems.kind, lead: articles.lead, anchorName: users.displayName, anchorColor: users.color })
    .from(rundownItems)
    .leftJoin(articles, eq(articles.id, rundownItems.articleId))
    .leftJoin(users, eq(users.id, rundownItems.anchorId))
    .where(where)
    .limit(1);
  if (row) itemRow = row;
  return { episode: ep, item: itemRow };
}

type Payload = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export async function resolveOverlay(db: DB, key: OverlayKey): Promise<{ state: OverlayState; version: string }> {
  const [row] = await db.select().from(overlayStates).where(eq(overlayStates.key, key));
  const mode = row?.mode ?? "AUTO";
  const payload = (row?.payload ?? {}) as Payload;
  const off = mode === "OFF";

  switch (key) {
    case "breaking": {
      const active = (await getActiveBreaking(db)).filter((b) => b.showOnOverlay);
      let item: LiveBreaking | null = null;
      if (mode === "MANUAL") item = active.find((b) => b.id === payload.breakingId) ?? null;
      else if (mode === "AUTO") item = active[0] ?? null;
      return { state: { key, visible: !off && !!item, item }, version: `${row?.version}:${item?.id}:${item?.correctedAt}` };
    }
    case "ticker": {
      let items: { label: string; text: string; urgent?: boolean }[] = [];
      if (mode === "MANUAL") {
        items = (Array.isArray(payload.items) ? payload.items : []).filter((t): t is string => typeof t === "string").map((text) => ({ label: "RWN", text }));
      } else if (mode === "AUTO") {
        const [breaking, latest] = await Promise.all([
          getActiveBreaking(db),
          db.select({ title: articles.title }).from(articles).where(articleVisible).orderBy(desc(articles.publishedAt)).limit(5),
        ]);
        items = [
          ...breaking.filter((b) => b.showOnOverlay).map((b) => ({ label: b.priority === "URGENT" ? "긴급" : "속보", text: b.title, urgent: b.priority === "URGENT" })),
          ...latest.map((a) => ({ label: "뉴스", text: a.title })),
        ];
      }
      return { state: { key, visible: !off && items.length > 0, items }, version: `${row?.version}:${items.map((i) => i.text).join("|")}` };
    }
    case "headline": {
      if (mode === "MANUAL") {
        const title = str(payload.title) ?? "";
        return {
          state: { key, visible: !!title, label: str(payload.label) ?? "RWN 뉴스", title, subtitle: str(payload.subtitle) },
          version: `${row?.version}`,
        };
      }
      const { item } = off ? { item: null } : await getLiveEpisodeContext(db);
      return {
        state: { key, visible: !off && !!item, label: "RWN 뉴스", title: item?.title ?? "", subtitle: item?.lead ?? null },
        version: `${row?.version}:${item?.title}`,
      };
    }
    case "lower_third": {
      if (mode === "MANUAL") {
        const name = str(payload.name) ?? "";
        return { state: { key, visible: !!name, name, role: str(payload.role) ?? "", color: null }, version: `${row?.version}` };
      }
      const { item } = off ? { item: null } : await getLiveEpisodeContext(db);
      return {
        state: { key, visible: !off && !!item?.anchorName, name: item?.anchorName ?? "", role: "RWN 앵커", color: item?.anchorColor ?? null },
        version: `${row?.version}:${item?.anchorName}`,
      };
    }
    case "war_status": {
      const [ev] = await db.select().from(events).where(eq(events.isActive, true)).orderBy(desc(events.createdAt)).limit(1);
      const teamRows = ev
        ? await db
            .select()
            .from(teams)
            .where(and(eq(teams.eventId, ev.id), eq(teams.isPublic, true)))
            .orderBy(desc(teams.score), asc(teams.name))
        : [];
      const list = teamRows.map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        color: t.color,
        score: t.score,
        statusLabel: t.statusLabel,
        isEliminated: t.isEliminated,
      }));
      return {
        state: { key, visible: !off && list.length > 0, title: str(payload.title) ?? ev?.name ?? "전쟁 현황", teams: list },
        version: `${row?.version}:${teamRows.map((t) => `${t.id}${t.version}`).join(",")}`,
      };
    }
    case "standby": {
      if (mode === "MANUAL") {
        return {
          state: { key, visible: true, title: str(payload.title) ?? "RUST WAR NEWS", message: str(payload.message), startsAt: str(payload.startsAt) },
          version: `${row?.version}`,
        };
      }
      const [liveEp] = await db.select({ id: episodes.id }).from(episodes).where(eq(episodes.status, "LIVE")).limit(1);
      const [next] = await db
        .select()
        .from(episodes)
        .where(inArray(episodes.status, ["PLANNED", "READY"]))
        .orderBy(sql`${episodes.scheduledAt} asc nulls last`)
        .limit(1);
      return {
        state: {
          key,
          visible: !off && !liveEp,
          title: next?.title ?? "RUST WAR NEWS",
          message: next ? "곧 방송이 시작됩니다" : "잠시 후 방송이 이어집니다",
          startsAt: next?.scheduledAt?.toISOString() ?? null,
        },
        version: `${row?.version}:${next?.id}:${!!liveEp}`,
      };
    }
  }
}
