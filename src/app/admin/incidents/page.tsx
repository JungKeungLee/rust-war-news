import { getDb } from "@/db";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { IncidentsManager } from "@/components/admin/IncidentsManager";

export const metadata = { title: "사건 관리" };

export default async function AdminIncidentsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!(await requirePagePermission("incidents.manage"))) return <Forbidden />;
  const { id } = await searchParams;
  const lookups = await getLookups(await getDb());
  return (
    <>
      <AdminTitle title="사건 관리" desc="사건은 제보·속보·기사·클립을 묶는 중심 단위입니다. 사실 확인 상태와 공개 여부·공개 가능 시각을 관리합니다." />
      <IncidentsManager teams={lookups.teams} events={lookups.events} initialId={id ?? null} />
    </>
  );
}
