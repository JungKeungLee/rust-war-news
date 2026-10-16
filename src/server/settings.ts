import "server-only";
import { inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { siteSettings } from "@/db/schema";

export type LiveSetting = { isLive: boolean; url: string | null; title: string | null };
export type NoticeSetting = { text: string | null };
export type IntakeSetting = { reportsOpen: boolean; clipsOpen: boolean };

export type Settings = { live: LiveSetting; notice: NoticeSetting; intake: IntakeSetting };

const DEFAULTS: Settings = {
  live: { isLive: false, url: null, title: null },
  notice: { text: null },
  intake: { reportsOpen: true, clipsOpen: true },
};

export async function getSettings(db: DB): Promise<Settings> {
  const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, Object.keys(DEFAULTS)));
  const out = structuredClone(DEFAULTS) as Record<string, unknown>;
  for (const r of rows) out[r.key] = { ...(DEFAULTS as Record<string, object>)[r.key], ...(r.value as object) };
  return out as Settings;
}
