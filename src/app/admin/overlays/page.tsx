import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { OverlaysManager } from "@/components/admin/OverlaysManager";

export const metadata = { title: "OBS 송출 관리" };

export default async function AdminOverlaysPage() {
  if (!(await requirePagePermission("overlays.manage"))) return <Forbidden />;
  return (
    <>
      <AdminTitle
        title="OBS 송출 관리"
        desc="각 오버레이는 자동(속보·큐시트 연동) / 수동 입력 / 끄기 모드로 운영합니다. OBS 브라우저 소스는 1920×1080, 투명 배경으로 등록하세요."
      />
      <OverlaysManager />
    </>
  );
}
