import type { Metadata } from "next";
import { cookies } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pollVotes } from "@/db/schema";
import { listPublicPolls } from "@/server/public";
import { canSeeResults, isPollOpen, VOTER_COOKIE, voterKeyFrom } from "@/server/polls";
import { PollCard } from "@/components/site/PollCard";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "시청자 투표" };

export default async function PollsPage() {
  const db = await getDb();
  const list = await listPublicPolls(db);
  const voterKey = voterKeyFrom((await cookies()).get(VOTER_COOKIE)?.value);
  const myVotes =
    voterKey && list.length
      ? await db
          .select({ pollId: pollVotes.pollId, optionId: pollVotes.optionId })
          .from(pollVotes)
          .where(and(eq(pollVotes.voterKey, voterKey), inArray(pollVotes.pollId, list.map((l) => l.poll.id))))
      : [];

  return (
    <>
      <PageHeader
        kicker="VIEWER POLL"
        title="시청자 투표"
        desc="브라우저당 1회 참여할 수 있습니다. 익명 쿠키 기반이라 완벽한 중복 방지는 아니며, 결과는 시청자 참여 지표로 활용됩니다."
      />
      {list.length === 0 ? (
        <EmptyState title="진행 중인 투표가 없습니다" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map(({ poll, options }) => {
            const mine = myVotes.find((v) => v.pollId === poll.id)?.optionId ?? null;
            const showResults = canSeeResults(poll, !!mine);
            return (
              <PollCard
                key={poll.id}
                poll={{ id: poll.id, question: poll.question, description: poll.description, endsAt: poll.endsAt?.toISOString() ?? null }}
                options={options.map((o) => ({ id: o.id, label: o.label, votes: showResults ? o.votes : null }))}
                open={isPollOpen(poll)}
                myOptionId={mine}
                resultNote={showResults ? null : poll.resultVisibility === "AFTER_CLOSE" ? "결과는 투표 종료 후 공개됩니다." : "투표 후 결과를 볼 수 있습니다."}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
