import { redirect } from "next/navigation";
import { getCurrentSession, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

/** 관리자 페이지 서버 측 권한 확인. 권한이 없으면 null (화면에서 Forbidden 렌더) */
export async function requirePagePermission(perm: Permission): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/admin");
  return hasPermission(session.roles, perm) ? session : null;
}

export function Forbidden() {
  return (
    <div className="panel mx-auto mt-10 max-w-md p-8 text-center">
      <div className="font-mono text-xs tracking-widest text-alert">NO CLEARANCE</div>
      <h1 className="mt-2 text-xl font-black">이 화면에 접근할 권한이 없습니다</h1>
      <p className="mt-2 text-sm text-muted">필요한 역할이 있다면 최고 관리자에게 요청하세요.</p>
    </div>
  );
}

export function AdminTitle({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-2 border-b border-line pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
