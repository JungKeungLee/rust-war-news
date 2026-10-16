import { teams } from "@/db/schema";
import { adminRoute, readJson, versionedUpdate } from "@/lib/api/handler";
import { TeamFields } from "@/lib/schemas";
import { zUuid, zVersion } from "@/lib/validation";
import { eq } from "drizzle-orm";
import { notFound } from "@/lib/api/errors";

const PatchInput = TeamFields.extend({ version: zVersion });

export const PATCH = adminRoute<{ id: string }>("teams.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const { version, ...input } = await readJson(req, PatchInput);
  const row = await versionedUpdate(db, teams, id, version, input);
  await audit("TEAM_UPDATE", "team", id, { score: row.score, statusLabel: row.statusLabel, isPublic: row.isPublic });
  return { team: row };
});

/** 팀 삭제: 소속·사건 연결은 함께 삭제(CASCADE), 클립의 팀 연결은 해제(SET NULL) */
export const DELETE = adminRoute<{ id: string }>("teams.manage", async ({ db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const [row] = await db.delete(teams).where(eq(teams.id, id)).returning({ id: teams.id, name: teams.name });
  if (!row) throw notFound("팀");
  await audit("TEAM_DELETE", "team", id, { name: row.name });
  return { ok: true };
});
