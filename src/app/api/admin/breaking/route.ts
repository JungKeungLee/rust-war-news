import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { breakingNews, breakingRevisions, incidents } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { BreakingFields } from "@/lib/schemas";

export const GET = adminRoute("breaking.manage", async ({ db }) => {
  const rows = await db
    .select({ breaking: breakingNews, incidentTitle: incidents.title })
    .from(breakingNews)
    .leftJoin(incidents, eq(incidents.id, breakingNews.incidentId))
    .orderBy(desc(breakingNews.createdAt))
    .limit(150);
  return { serverTime: new Date().toISOString(), items: rows.map((r) => ({ ...r.breaking, incidentTitle: r.incidentTitle })) };
});

const CreateInput = BreakingFields.extend({ publish: z.enum(["draft", "now", "schedule"]) });

/** 속보 작성: 임시저장 / 즉시 발행 / 예약 발행 */
export const POST = adminRoute("breaking.manage", async ({ req, db, session, audit }) => {
  const { publish, ...input } = await readJson(req, CreateInput);
  const now = new Date();
  let status: "DRAFT" | "LIVE" | "SCHEDULED" = "DRAFT";
  let startsAt = input.startsAt;
  if (publish === "now") {
    status = "LIVE";
    startsAt = now;
  } else if (publish === "schedule") {
    if (!startsAt || startsAt <= now) throw new ApiError(400, "예약 발행은 미래의 노출 시작 시각이 필요합니다.");
    status = "SCHEDULED";
  }
  if (input.endsAt && startsAt && input.endsAt <= startsAt) throw new ApiError(400, "노출 종료 시각은 시작 시각 이후여야 합니다.");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(breakingNews)
      .values({ ...input, status, startsAt, publishedAt: status === "DRAFT" ? null : now, createdBy: session.userId })
      .returning();
    await tx.insert(breakingRevisions).values({ breakingId: row.id, action: status === "DRAFT" ? "CREATE" : status === "LIVE" ? "PUBLISH" : "SCHEDULE", title: row.title, body: row.body, userId: session.userId });
    await audit(`BREAKING_${status === "DRAFT" ? "CREATE" : status}`, "breaking", row.id, { title: row.title, priority: row.priority }, tx);
    return { breaking: row };
  });
});
