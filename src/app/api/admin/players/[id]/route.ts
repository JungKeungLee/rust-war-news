import { eq } from "drizzle-orm";
import { players } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { PlayerFields } from "@/lib/schemas";
import { zUuid } from "@/lib/validation";

export const PATCH = adminRoute<{ id: string }>("teams.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, PlayerFields);
  const [row] = await db.update(players).set({ ...input, updatedAt: new Date() }).where(eq(players.id, id)).returning();
  if (!row) throw notFound("선수");
  await audit("PLAYER_UPDATE", "player", id, { nickname: row.nickname });
  return { player: row };
});

export const DELETE = adminRoute<{ id: string }>("teams.manage", async ({ db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const [row] = await db.delete(players).where(eq(players.id, id)).returning({ id: players.id });
  if (!row) throw notFound("선수");
  await audit("PLAYER_DELETE", "player", id);
  return { ok: true };
});
