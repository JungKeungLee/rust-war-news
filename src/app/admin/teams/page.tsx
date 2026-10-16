import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { TeamsManager } from "@/components/admin/TeamsManager";

export const metadata = { title: "팀·선수 관리" };

export default async function AdminTeamsPage() {
  if (!(await requirePagePermission("teams.manage"))) return <Forbidden />;
  return (
    <>
      <AdminTitle title="팀 · 선수 관리" desc="대결(시즌) → 팀 → 소속 선수 구조로 관리합니다. 팀 점수·상태는 전쟁 상황판과 OBS 현황판에 반영됩니다." />
      <TeamsManager />
    </>
  );
}
