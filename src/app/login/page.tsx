import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "운영진 로그인", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  if (await getCurrentSession()) redirect(safeNext);
  return (
    <div className="ops-grid flex min-h-dvh items-center justify-center p-4">
      <div className="panel w-full max-w-sm p-6">
        <Logo />
        <div className="panel-head mt-4">Restricted · 운영진 전용</div>
        <h1 className="mb-4 mt-1 text-xl font-black">관리자 로그인</h1>
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
