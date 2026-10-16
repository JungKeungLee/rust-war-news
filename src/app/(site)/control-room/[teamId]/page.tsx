import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getTeamControlRoom } from "@/server/control-room";
import { TeamControlRoomView } from "@/components/site/TeamControlRoomView";

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function generateMetadata({ params }: { params: Promise<{ teamId: string }> }): Promise<Metadata> {
  const { teamId } = await params;
  if (!isUuid(teamId)) return {};
  const data = await getTeamControlRoom(await getDb(), teamId);
  return data ? { title: `${data.team.name} 지통실` } : {};
}

/** 공개 팀별 지통실 — 로그인 없이 열람. 없는/비공개 팀은 404 */
export default async function TeamControlRoomPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (!isUuid(teamId)) notFound();
  const data = await getTeamControlRoom(await getDb(), teamId);
  if (!data) notFound();
  return <TeamControlRoomView initial={JSON.parse(JSON.stringify(data))} />;
}
