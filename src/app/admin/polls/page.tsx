import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { PollsManager } from "@/components/admin/PollsManager";

export const metadata = { title: "시청자 투표" };

export default async function AdminPollsPage() {
  if (!(await requirePagePermission("polls.manage"))) return <Forbidden />;
  return (
    <>
      <AdminTitle
        title="시청자 투표"
        desc="중복 투표는 브라우저 익명 쿠키(HMAC 저장) + 네트워크당 상한으로 제한합니다. 쿠키 삭제·다른 기기로 재투표가 가능하므로 결과는 참여 지표로만 활용하세요."
      />
      <PollsManager />
    </>
  );
}
