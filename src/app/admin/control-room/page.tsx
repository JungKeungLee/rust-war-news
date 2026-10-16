import { getDb } from "@/db";
import { getControlRoomSnapshot } from "@/server/admin";
import { ControlRoom } from "@/components/admin/ControlRoom";
import { Forbidden, requirePagePermission } from "@/components/admin/guard";

export const metadata = { title: "방송 지통실" };

export default async function ControlRoomPage() {
  if (!(await requirePagePermission("admin.access"))) return <Forbidden />;
  const snap = await getControlRoomSnapshot(await getDb());
  return <ControlRoom initial={JSON.parse(JSON.stringify(snap))} />;
}
