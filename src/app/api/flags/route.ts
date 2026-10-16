import { z } from "zod";
import { contentFlags } from "@/db/schema";
import { publicRoute, readJson } from "@/lib/api/handler";
import { rateLimit } from "@/lib/security/rate-limit";
import { zText } from "@/lib/validation";

const FlagInput = z.object({
  targetType: z.enum(["article", "clip", "report"]),
  targetId: z.uuid(),
  reason: zText(300, 2),
});

/** 사용자 신고 (오보·권리 침해·개인정보 노출 등). 관리자 대시보드에서 처리한다. */
export const POST = publicRoute(async ({ req, db, ipHash }) => {
  await rateLimit(db, `flag:1h:${ipHash}`, 10, 3600);
  const input = await readJson(req, FlagInput);
  await db.insert(contentFlags).values({ ...input, reporterIpHash: ipHash });
  return { ok: true };
});
