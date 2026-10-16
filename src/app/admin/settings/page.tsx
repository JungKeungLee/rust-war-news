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
      <AdminTitle title="사이트 설정" desc="상단 공지와 제보·클립 접수 여부를 설정합니다. 메인 방송은 방송 설정 메뉴에서 관리합니다." />
      <SettingsForm initial={settings} />
    </>
  );
}
