import { adminRoute } from "@/lib/api/handler";
import { getControlRoomSnapshot } from "@/server/admin";

export const dynamic = "force-dynamic";

/** 방송 지통실 전체 상태 (관리자 화면이 4초마다 폴링) */
export const GET = adminRoute("admin.access", async ({ db }) => getControlRoomSnapshot(db));
