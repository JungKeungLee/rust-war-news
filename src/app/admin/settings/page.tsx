import { getDb } from "@/db";
import { getSettings } from "@/server/settings";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "사이트 설정" };

export default async function AdminSettingsPage() {
  if (!(await requirePagePermission("settings.manage"))) return <Forbidden />;
  const settings = await getSettings(await getDb());
  return (
    <>
      <AdminTitle title="사이트 설정" desc="LIVE 표시·방송 링크, 상단 공지, 제보·클립 접수 여부를 설정합니다. 방송 회차를 시작·종료하면 LIVE 표시가 자동으로 바뀝니다." />
      <SettingsForm initial={settings} />
    </>
  );
}
