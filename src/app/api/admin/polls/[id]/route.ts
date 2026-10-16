import { z } from "zod";
import { polls } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { zUuid, zVersion } from "@/lib/validation";

const Input = z.object({ version: zVersion, action: z.enum(["open", "close", "reopen"]) });

/** 투표 시작·관리자 종료 */
export const PATCH = adminRoute<{ id: string }>("polls.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const { version, action } = await readJson(req, Input);
  const values =
    action === "close" ? { status: "CLOSED" as const, closedAt: new Date() } : { status: "OPEN" as const, closedAt: null };
  const row = await versionedUpdate(db, polls, id, version, values);
  await audit(`POLL_${action.toUpperCase()}`, "poll", id);
  return { poll: row };
});
