import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { DB, Tx } from "@/db";
import { siteSettings } from "@/db/schema";
import { DEFAULT_BROADCAST, type BroadcastSetting } from "@/lib/broadcast";
import { BROADCAST_STATUS } from "@/lib/labels";

export type LiveSetting = { isLive: boolean; url: string | null; title: string | null };
export type NoticeSetting = { text: string | null };
export type IntakeSetting = { reportsOpen: boolean; clipsOpen: boolean };

export type Settings = {
  /** 메인 방송 (site_settings.broadcast). 상태는 관리자 수동 설정 */
  broadcast: BroadcastSetting;
  broadcastMeta: { updatedAt: Date | null; updatedBy: string | null; exists: boolean };
  /** 하위 호환: 상단 LIVE 표시. broadcast 에서 계산한다 */
  live: LiveSetting;
  notice: NoticeSetting;
  intake: IntakeSetting;
};

const KEYS = ["broadcast", "live", "notice", "intake"];

export async function getSettings(db: DB | Tx): Promise<Settings> {
  const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, KEYS));
  const get = (k: string) => rows.find((r) => r.key === k);
  const legacyLive = { isLive: false, url: null, title: null, ...((get("live")?.value as object) ?? {}) } as LiveSetting;
  const bRow = get("broadcast");

  let broadcast: BroadcastSetting;
  if (bRow) {
    broadcast = { ...DEFAULT_BROADCAST, ...(bRow.value as Partial<BroadcastSetting>) };
    if (!(BROADCAST_STATUS as readonly string[]).includes(broadcast.status)) broadcast.status = "UNKNOWN";
  } else {
    // 방송 설정을 저장한 적 없으면 기존 LIVE 설정에서 이어받는다
    broadcast = { ...DEFAULT_BROADCAST, url: legacyLive.url, title: legacyLive.title, status: legacyLive.isLive ? "LIVE" : "STANDBY" };
  }

  return {
    broadcast,
    broadcastMeta: { updatedAt: bRow?.updatedAt ?? null, updatedBy: bRow?.updatedBy ?? null, exists: !!bRow },
    live: { isLive: broadcast.isPublic && broadcast.status === "LIVE" && !!broadcast.url, url: broadcast.isPublic ? broadcast.url : null, title: broadcast.isPublic ? broadcast.title : null },
    notice: { text: null, ...((get("notice")?.value as object) ?? {}) } as NoticeSetting,
    intake: { reportsOpen: true, clipsOpen: true, ...((get("intake")?.value as object) ?? {}) } as IntakeSetting,
  };
}

/** 방송 설정 저장 (upsert). 호출자가 감사 로그를 남긴다 */
export async function saveBroadcast(db: DB | Tx, value: BroadcastSetting, userId: string | null) {
  const now = new Date();
  await db
    .insert(siteSettings)
    .values({ key: "broadcast", value, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedBy: userId, updatedAt: now } });
  const [row] = await db.select({ updatedAt: siteSettings.updatedAt }).from(siteSettings).where(eq(siteSettings.key, "broadcast"));
  return row.updatedAt;
}
