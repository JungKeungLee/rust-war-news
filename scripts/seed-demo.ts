/**
 * 데모 데이터 (로컬 개발·테스트용): 진행 중 대결 1개, 팀 4개, 선수 8명.
 * 이미 대결이 하나라도 있으면 아무 것도 하지 않는다. 운영 DB에서는 실행하지 마세요.
 */
import "dotenv/config";
import { createDb } from "../src/db/client";
import { events, players, teamMembers, teams } from "../src/db/schema";

const TEAMS = [
  { name: "북부 연합", shortName: "NOR", color: "#ef4444", statusLabel: "공세", score: 12 },
  { name: "해안 방위대", shortName: "CST", color: "#3b82f6", statusLabel: "수세", score: 9 },
  { name: "사막 여우단", shortName: "DST", color: "#eab308", statusLabel: "정찰", score: 7 },
  { name: "철갑 길드", shortName: "IRN", color: "#22c55e", statusLabel: "재정비", score: 4 },
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("운영 환경에서는 데모 데이터를 넣지 않습니다.");
  const db = await createDb(process.env.DATABASE_URL);
  const existing = await db.select({ id: events.id }).from(events).limit(1);
  if (existing.length) {
    console.log("대결 데이터가 이미 있어 건너뜁니다.");
    process.exit(0);
  }
  const [ev] = await db
    .insert(events)
    .values({ name: "러스트 대전 시즌 1", season: "S1", description: "데모용 대결", isActive: true, startsAt: new Date() })
    .returning();
  const teamRows = await db
    .insert(teams)
    .values(TEAMS.map((t) => ({ ...t, eventId: ev.id, description: `${t.name} 데모 팀 소개` })))
    .returning();
  const playerRows = await db
    .insert(players)
    .values(Array.from({ length: 8 }, (_, i) => ({ nickname: `데모선수${i + 1}`, profile: "데모 선수 프로필" })))
    .returning();
  await db.insert(teamMembers).values(playerRows.map((p, i) => ({ teamId: teamRows[i % teamRows.length].id, playerId: p.id, role: i < 4 ? "리더" : "멤버", joinedAt: new Date() })));
  console.log(`데모 데이터 생성: 대결 1, 팀 ${teamRows.length}, 선수 ${playerRows.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
