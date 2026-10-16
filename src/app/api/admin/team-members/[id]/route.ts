import { eq } from "drizzle-orm";
import { z } from "zod";
import { teamMembers } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { zOptDate, zOptText, zUuid } from "@/lib/validation";

const Input = z.object({ role: zOptText(20).optional(), leftAt: zOptDate.optional() });

/** 역할 변경 또는 탈퇴 처리(leftAt) */
export const PATCH = adminRoute<{ id: string }>("teams.manage", async ({ req, db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const input = await readJson(req, Input);
  const values = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const [row] = await db.update(teamMembers).set(values).where(eq(teamMembers.id, id)).returning();
  if (!row) throw notFound("소속");
  await audit("MEMBER_UPDATE", "team_member", id, values);
  return { member: row };
});

export const DELETE = adminRoute<{ id: string }>("teams.manage", async ({ db, params, audit }) => {
  const id = zUuid.parse(params.id);
  const [row] = await db.delete(teamMembers).where(eq(teamMembers.id, id)).returning({ id: teamMembers.id });
  if (!row) throw notFound("소속");
  await audit("MEMBER_REMOVE", "team_member", id);
  return { ok: true };
});
