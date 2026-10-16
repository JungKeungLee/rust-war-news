import { getDb } from "@/db";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { ClipsManager } from "@/components/admin/ClipsManager";

export const metadata = { title: "클립 관리" };

export default async function AdminClipsPage() {
  if (!(await requirePagePermission("clips.manage"))) return <Forbidden />;
  const lookups = await getLookups(await getDb());
  return (
    <>
      <AdminTitle
        title="클립 관리"
        desc="YouTube·Twitch 클립은 자동 임베드됩니다. SOOP·치지직은 공개 임베드 형식이 문서로 확인되지 않아 기본은 외부 링크이며, 플랫폼 공유 메뉴의 임베드 주소를 직접 넣으면 임베드됩니다."
      />
      <ClipsManager incidents={lookups.incidents} teams={lookups.teams} />
    </>
  );
}
