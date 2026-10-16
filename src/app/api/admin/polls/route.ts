import { asc, count, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { pollOptions, polls, pollVotes } from "@/db/schema";
import { adminRoute, readJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { PollFields } from "@/lib/schemas";
import { zText } from "@/lib/validation";

export const GET = adminRoute("polls.manage", async ({ db }) => {
  const list = await db.select().from(polls).orderBy(desc(polls.createdAt)).limit(100);
  const ids = list.map((p) => p.id);
  const [opts, counts] = ids.length
    ? await Promise.all([
        db.select().from(pollOptions).where(inArray(pollOptions.pollId, ids)).orderBy(asc(pollOptions.position)),
        db.select({ optionId: pollVotes.optionId, n: count() }).from(pollVotes).where(inArray(pollVotes.pollId, ids)).groupBy(pollVotes.optionId),
      ])
    : [[], []];
  return {
    items: list.map((p) => ({
      ...p,
      options: opts.filter((o) => o.pollId === p.id).map((o) => ({ ...o, votes: counts.find((c) => c.optionId === o.id)?.n ?? 0 })),
    })),
  };
});

const CreateInput = PollFields.extend({ options: z.array(zText(80)).min(2, "보기를 2개 이상 입력하세요.").max(10), open: z.boolean().default(false) });

export const POST = adminRoute("polls.manage", async ({ req, db, session, audit }) => {
  const { options, open, ...input } = await readJson(req, CreateInput);
  if (input.endsAt && input.startsAt && input.endsAt <= input.startsAt) throw new ApiError(400, "종료 시각은 시작 시각 이후여야 합니다.");
  return db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(polls)
      .values({ ...input, status: open ? "OPEN" : "DRAFT", createdBy: session.userId })
      .returning();
    await tx.insert(pollOptions).values(options.map((label, position) => ({ pollId: poll.id, label, position })));
    await audit("POLL_CREATE", "poll", poll.id, { question: poll.question }, tx);
    return { poll };
  });
});
