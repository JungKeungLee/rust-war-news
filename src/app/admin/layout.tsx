import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/permissions";
import { AdminProvider } from "@/components/admin/AdminContext";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "관리자", template: "%s | RWN 관리자" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/admin");

  if (!hasPermission(session.roles, "admin.access")) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="panel max-w-md p-8 text-center">
          <div className="font-mono text-xs tracking-widest text-alert">ACCESS DENIED</div>
          <h1 className="mt-2 text-xl font-black">관리자 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-muted">최고 관리자에게 역할 부여를 요청하세요.</p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  const user = { id: session.userId, email: session.email, displayName: session.displayName, roles: session.roles };
  return (
    <AdminProvider user={user} csrfToken={session.csrfToken}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <aside className="border-b border-line bg-[#05080f] lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 p-4">
            <Link href="/admin">
              <Logo size="sm" />
            </Link>
            <Link href="/" className="whitespace-nowrap text-xs text-muted hover:text-ink" target="_blank">
              사이트 ↗
            </Link>
          </div>
          <AdminNav />
          <div className="hidden border-t border-line p-4 text-xs text-muted lg:block">
            <div className="font-bold text-ink">{session.displayName}</div>
            <div className="mt-0.5">{session.roles.map((r) => ROLE_LABELS[r]).join(", ")}</div>
            <div className="mt-3">
              <LogoutButton />
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </AdminProvider>
  );
}
