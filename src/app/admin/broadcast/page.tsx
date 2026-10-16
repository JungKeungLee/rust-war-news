import { getDb } from "@/db";
import { getSettings } from "@/server/settings";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { BroadcastForm } from "@/components/admin/BroadcastForm";

export const metadata = { title: "방송 설정" };

export default async function AdminBroadcastPage() {
  if (!(await requirePagePermission("broadcast.manage"))) return <Forbidden />;
  const s = await getSettings(await getDb());
  return (
    <>
      <AdminTitle
        title="메인 방송 설정"
        desc="메인 페이지 플레이어에 나갈 RWN 뉴스 방송 1개를 설정합니다. 방송 상태는 외부 플랫폼에서 자동 감지하지 않으며, 여기서 수동으로 지정한 값이 표시됩니다."
      />
      <BroadcastForm initial={s.broadcast} initialUpdatedAt={s.broadcastMeta.updatedAt?.toISOString() ?? null} />
    </>
  );
}
