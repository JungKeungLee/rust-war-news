import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { UsersManager } from "@/components/admin/UsersManager";

export const metadata = { title: "계정·권한" };

export default async function AdminUsersPage() {
  const session = await requirePagePermission("users.manage");
  if (!session) return <Forbidden />;
  return (
    <>
      <AdminTitle
        title="관리자 계정 · 권한"
        desc="한 계정에 여러 역할을 줄 수 있습니다. 뉴스 진행자(난워니·김옥독 등)는 ANCHOR 역할을 부여하면 큐시트·대본에서 선택할 수 있습니다."
      />
      <UsersManager selfId={session.userId} />
    </>
  );
}
