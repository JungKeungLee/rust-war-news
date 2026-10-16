import { publicRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { getTeamControlRoom } from "@/server/control-room";

export const dynamic = "force-dynamic";

/** 공개 팀별 지통실 (로그인 불필요). 비공개·없는 팀은 404. 클라이언트 10초 폴링 + ETag, CDN 5초 캐시 */
export const GET = publicRoute<{ teamId: string }>(
  async ({ db, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.teamId)) throw notFound("팀");
    const data = await getTeamControlRoom(db, params.teamId);
    if (!data) throw notFound("팀");
    return data;
  },
  { cacheSeconds: 5 },
);
