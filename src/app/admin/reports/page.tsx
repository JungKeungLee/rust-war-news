import { getDb } from "@/db";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { ReportsManager } from "@/components/admin/ReportsManager";

export const metadata = { title: "제보 검토" };

export default async function AdminReportsPage() {
  if (!(await requirePagePermission("reports.review"))) return <Forbidden />;
  const lookups = await getLookups(await getDb());
  return (
    <>
      <AdminTitle title="제보 검토" desc="접수 → 확인 중 → 승인/반려 → (기사 발행 시) 기사화. 승인 전 제보는 공개되지 않습니다. 5초마다 자동 갱신됩니다." />
      <ReportsManager incidents={lookups.incidents} events={lookups.events} />
    </>
  );
}
