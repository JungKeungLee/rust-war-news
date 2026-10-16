import { eq } from "drizzle-orm";
import { z } from "zod";
import { contentFlags } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { zUuid } from "@/lib/validation";

const Input = z.object({ status: z.enum(["RESOLVED", "DISMISSED", "OPEN"]) });

export const PATCH = adminRoute<{ id: string }>("flags.manage", async ({ req, db, params, session, audit }) => {
  const id = zUuid.parse(params.id);
  const { status } = await readJson(req, Input);
  const [row] = await db.update(contentFlags).set({ status, resolvedBy: session.userId }).where(eq(contentFlags.id, id)).returning();
  if (!row) throw notFound("신고");
  await audit("FLAG_" + status, "flag", id);
  return { flag: row };
});
