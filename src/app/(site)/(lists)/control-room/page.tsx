import type { Metadata } from "next";
import { getDb } from "@/db";
import { getControlRoomOverview } from "@/server/control-room";
import { PublicControlRoom } from "@/components/site/PublicControlRoom";

export const metadata: Metadata = { title: "종합 지통실", description: "RWN 방송국이 확인·공개한 러스트 대결 팀별 현황" };

/** 공개 종합 지통실 — 로그인 없이 누구나 열람 (관리자 방송 운영실은 /admin/control-room) */
export default async function ControlRoomPage() {
  const overview = await getControlRoomOverview(await getDb());
  return <PublicControlRoom initial={JSON.parse(JSON.stringify(overview))} />;
}
