import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ConflictError } from "@/lib/api/errors";
import { buildBroadcastEmbed, toPublicBroadcast, type BroadcastSetting } from "@/lib/broadcast";
import { siteHostFromEnv } from "@/lib/clips/embed";
import { BROADCAST_STATUS } from "@/lib/labels";
import { zOptText, zOptUrl } from "@/lib/validation";
import { getSettings, saveBroadcast } from "@/server/settings";

/** 메인 방송 설정 조회 (관리자) + 공개 화면에 실제로 나갈 형태 미리보기 */
export const GET = adminRoute("broadcast.manage", async ({ db }) => {
  const s = await getSettings(db);
  return {
    broadcast: s.broadcast,
    updatedAt: s.broadcastMeta.updatedAt?.toISOString() ?? null,
    preview: toPublicBroadcast(s.broadcast, s.broadcastMeta.updatedAt, siteHostFromEnv()),
  };
});

const zImage = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (!v) return null;
    if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(v)) return v;
    const r = zOptUrl.safeParse(v);
    if (!r.success || !r.data) {
      ctx.addIssue({ code: "custom", message: "썸네일은 업로드 이미지 또는 https 주소만 가능합니다." });
      return z.NEVER;
    }
    return r.data;
  });

const Input = z.object({
  url: zOptUrl,
  title: zOptText(100),
  description: zOptText(500, true),
  thumbnailUrl: zImage,
  status: z.enum(BROADCAST_STATUS),
  offlineMessage: zOptText(200, true),
  isPublic: z.boolean(),
  /** 편집을 시작할 때 본 마지막 수정 시각. 그 사이 다른 관리자가 바꿨으면 409 */
  expectedUpdatedAt: z.string().nullable(),
});

export const PATCH = adminRoute("broadcast.manage", async ({ req, db, session, audit }) => {
  const { expectedUpdatedAt, ...value } = await readJson(req, Input);
  return db.transaction(async (tx) => {
    const before = await getSettings(tx);
    const currentStamp = before.broadcastMeta.updatedAt?.toISOString() ?? null;
    if (before.broadcastMeta.exists && currentStamp !== expectedUpdatedAt) {
      throw new ConflictError({ broadcast: before.broadcast, updatedAt: currentStamp });
    }
    const next: BroadcastSetting = value;
    const updatedAt = await saveBroadcast(tx, next, session.userId);
    const changed = Object.fromEntries(
      (Object.keys(next) as (keyof BroadcastSetting)[])
        .filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before.broadcast[k]))
        .map((k) => [k, { from: before.broadcast[k], to: next[k] }]),
    );
    await audit("BROADCAST_UPDATE", "setting", "broadcast", { changed, statusSource: "MANUAL" }, tx);
    return {
      broadcast: next,
      updatedAt: updatedAt.toISOString(),
      preview: toPublicBroadcast(next, updatedAt, siteHostFromEnv()),
      embed: next.url ? buildBroadcastEmbed(next.url, siteHostFromEnv()) : null,
    };
  });
});
