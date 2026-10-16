import { players } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { PlayerFields } from "@/lib/schemas";

export const POST = adminRoute("teams.manage", async ({ req, db, audit }) => {
  const input = await readJson(req, PlayerFields);
  const [row] = await db.insert(players).values(input).returning();
  await audit("PLAYER_CREATE", "player", row.id, { nickname: row.nickname });
  return { player: row };
});
