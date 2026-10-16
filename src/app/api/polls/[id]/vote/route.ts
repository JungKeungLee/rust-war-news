import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pollOptions, polls, pollVotes } from "@/db/schema";
import { publicRoute, readJson } from "@/lib/api/handler";
import { ApiError, notFound } from "@/lib/api/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { isPollOpen, MAX_VOTES_PER_IP_PER_POLL, newVoterId, VOTER_COOKIE, voterKeyFrom } from "@/server/polls";

const VoteInput = z.object({ optionId: z.uuid() });

export const POST = publicRoute<{ id: string }>(async ({ req, db, params, ipHash }) => {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound("투표");
  await rateLimit(db, `vote:1m:${ipHash}`, 15, 60);
  const { optionId } = await readJson(req, VoteInput);

  const [poll] = await db.select().from(polls).where(eq(polls.id, params.id));
  if (!poll) throw notFound("투표");
  if (!isPollOpen(poll)) throw new ApiError(409, "진행 중인 투표가 아닙니다.");
  const [opt] = await db.select().from(pollOptions).where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, poll.id)));
  if (!opt) throw new ApiError(400, "보기를 찾을 수 없습니다.");

  let vid = req.cookies.get(VOTER_COOKIE)?.value;
  let voterKey = voterKeyFrom(vid);
  if (!voterKey) {
    vid = newVoterId();
    voterKey = voterKeyFrom(vid)!;
  }

  const [ipCount] = await db.select({ n: count() }).from(pollVotes).where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.ipHash, ipHash)));
  if (ipCount.n >= MAX_VOTES_PER_IP_PER_POLL) throw new ApiError(429, "이 네트워크에서 참여 가능한 투표 수를 초과했습니다.");

  const inserted = await db
    .insert(pollVotes)
    .values({ pollId: poll.id, optionId: opt.id, voterKey, ipHash })
    .onConflictDoNothing()
    .returning({ id: pollVotes.id });

  const res = NextResponse.json(
    inserted.length ? { ok: true } : { ok: false, error: "이미 참여한 투표입니다." },
    { status: inserted.length ? 200 : 409, headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.set(VOTER_COOKIE, vid!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
});
