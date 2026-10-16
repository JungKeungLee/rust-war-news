import { getDb } from "@/db";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { BreakingManager } from "@/components/admin/BreakingManager";

export const metadata = { title: "속보 관리" };

export default async function AdminBreakingPage({ searchParams }: { searchParams: Promise<{ incident?: string }> }) {
  if (!(await requirePagePermission("breaking.manage"))) return <Forbidden />;
  const { incident } = await searchParams;
  const lookups = await getLookups(await getDb());
  return (
    <>
      <AdminTitle title="속보 관리" desc="즉시·예약 발행, 정정·취소·종료, 고정, OBS 노출, 기사 전환. 노출 종료 시각이 지나면 자동으로 내려갑니다." />
      <BreakingManager incidents={lookups.incidents} defaultIncidentId={incident && /^[0-9a-f-]{36}$/i.test(incident) ? incident : null} />
    </>
  );
}
