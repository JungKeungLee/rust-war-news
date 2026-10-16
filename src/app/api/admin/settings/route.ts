import { z } from "zod";
import { siteSettings } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { zOptText } from "@/lib/validation";
import { getSettings } from "@/server/settings";

export const GET = adminRoute("admin.access", async ({ db }) => ({ settings: await getSettings(db) }));

const Input = z.discriminatedUnion("key", [
  z.object({ key: z.literal("notice"), value: z.object({ text: zOptText(200) }) }),
  z.object({ key: z.literal("intake"), value: z.object({ reportsOpen: z.boolean(), clipsOpen: z.boolean() }) }),
]);

/** 사이트 설정: 공지, 제보 접수 여부 (메인 방송은 /api/admin/broadcast) */
export const PATCH = adminRoute("settings.manage", async ({ req, db, session, audit }) => {
  const { key, value } = await readJson(req, Input);
  await db
    .insert(siteSettings)
    .values({ key, value, updatedBy: session.userId })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedBy: session.userId, updatedAt: new Date() } });
  await audit("SETTINGS_UPDATE", "setting", key, value as Record<string, unknown>);
  return { settings: await getSettings(db) };
});
