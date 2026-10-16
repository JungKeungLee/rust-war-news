import { publicRoute } from "@/lib/api/handler";
import { getControlRoomOverview } from "@/server/control-room";

export const dynamic = "force-dynamic";

/** 공개 종합 지통실 (로그인 불필요). 클라이언트 15초 폴링 + ETag, CDN 5초 캐시 */
export const GET = publicRoute(async ({ db }) => getControlRoomOverview(db), { cacheSeconds: 5 });
