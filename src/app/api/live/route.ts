import { publicRoute } from "@/lib/api/handler";
import { getPublicLiveState } from "@/server/live";

export const dynamic = "force-dynamic";

/** 공개 실시간 상태 (속보 티커, LIVE 표시). 클라이언트가 3~5초마다 폴링한다. */
export const GET = publicRoute(async ({ db }) => getPublicLiveState(db));
