import { ne } from "drizzle-orm";
import { events } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { EventFields } from "@/lib/schemas";

/** 대결(시즌) 등록. 진행 중(isActive)은 하나만 유지한다. */
export const POST = adminRoute("teams.manage", async ({ req, db, audit }) => {
  const input = await readJson(req, EventFields);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(events).values(input).returning();
    if (row.isActive) await tx.update(events).set({ isActive: false }).where(ne(events.id, row.id));
    await audit("EVENT_CREATE", "event", row.id, { name: row.name }, tx);
    return { event: row };
  });
});
