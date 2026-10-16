import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { Logo } from "@/components/ui";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { PasswordChangeForm } from "./PasswordChangeForm";

export const metadata: Metadata = { title: "비밀번호 변경", robots: { index: false } };
export const dynamic = "force-dynamic";

/** 본인 비밀번호 변경. 임시 비밀번호 계정은 로그인 직후 이 화면으로 강제 이동된다. */
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/account/password");
  if (!hasPermission(session.roles, "admin.access")) redirect("/admin");
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";

  return (
    <div className="ops-grid flex min-h-dvh items-center justify-center p-4">
      <div className="panel w-full max-w-md p-6">
        <Logo />
        <div className="panel-head mt-4">Account Security</div>
        <h1 className="mb-1 mt-1 text-xl font-black">비밀번호 변경</h1>
        <p className="mb-4 text-sm text-muted">{session.displayName} 계정</p>
        {session.mustChangePassword && (
          <p className="mb-4 rounded border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
            관리자가 발급한 임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 설정하세요.
          </p>
        )}
        <PasswordChangeForm next={safeNext} />
        <div className="mt-4 flex justify-between border-t border-line pt-4">
          {!session.mustChangePassword ? (
            <a href="/admin" className="btn btn-sm btn-ghost">
              ← 관리자 화면
            </a>
          ) : (
            <span />
          )}
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
