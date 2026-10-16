import { z } from "zod";
import { teamMembers } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { zOptDate, zOptText } from "@/lib/validation";

const Input = z.object({ teamId: z.uuid(), playerId: z.uuid(), role: zOptText(20), joinedAt: zOptDate });

/** 팀원 연결 (팀이 시즌에 속하므로 시즌별 소속으로 관리된다) */
export const POST = adminRoute("teams.manage", async ({ req, db, audit }) => {
  const input = await readJson(req, Input);
  const [row] = await db.insert(teamMembers).values(input).returning();
  await audit("MEMBER_ADD", "team_member", row.id, input);
  return { member: row };
});
