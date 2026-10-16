import { and, eq, ne } from "drizzle-orm";
import { events } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { EventFields } from "@/lib/schemas";
import { zUuid } from "@/lib/validation";

export const PATCH = adminRoute<{ id: string }>("teams.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, EventFields);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(events).set({ ...input, updatedAt: new Date() }).where(eq(events.id, id)).returning();
    if (!row) throw notFound("대결");
    if (row.isActive) await tx.update(events).set({ isActive: false }).where(and(ne(events.id, id), eq(events.isActive, true)));
    await audit("EVENT_UPDATE", "event", id, { name: row.name, isActive: row.isActive }, tx);
    return { event: row };
  });
});
