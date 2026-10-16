import Link from "next/link";
import { getDb } from "@/db";
import { getPublicLiveState } from "@/server/live";
import { LiveBar } from "@/components/site/LiveBar";
import { Logo } from "@/components/ui";
import { MobileReportButton } from "@/components/site/MobileReportButton";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/news", label: "뉴스" },
  { href: "/breaking", label: "속보" },
  { href: "/war-room", label: "전쟁 상황판" },
  { href: "/clips", label: "핫 클립" },
  { href: "/teams", label: "팀·선수" },
  { href: "/reports", label: "제보" },
  { href: "/polls", label: "투표" },
  { href: "/archive", label: "다시보기" },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const db = await getDb();
  const live = await getPublicLiveState(db);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="RUST WAR NEWS 홈">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-panel2 hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/reports/new" className="btn btn-red btn-sm hidden sm:inline-flex">
              제보하기
            </Link>
            <details className="relative lg:hidden">
              <summary className="btn btn-sm list-none" aria-label="메뉴 열기">
                메뉴
              </summary>
              <nav className="panel absolute right-0 mt-2 grid w-56 gap-0.5 p-2 shadow-2xl">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded px-3 py-2.5 font-semibold hover:bg-panel2">
                    {n.label}
                  </Link>
                ))}
                <Link href="/clips/new" className="rounded px-3 py-2.5 font-semibold hover:bg-panel2">
                  클립 제보
                </Link>
              </nav>
            </details>
          </div>
        </div>
        <LiveBar initial={live} />
      </header>

      {live.notice && (
        <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-sm text-warn">{live.notice}</div>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-24 sm:py-8">{children}</main>

      <footer className="border-t border-line bg-[#05080f] px-4 py-8 pb-24 text-sm text-muted sm:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-dim">
              RWN은 Rust 대결 콘텐츠를 다루는 시청자 참여형 팬 뉴스 방송입니다. 게임 개발사·배급사 및 각 방송 플랫폼과 무관하며, 공식 사이트가 아닙니다.
              미확인 정보는 별도 표시되며 확인 결과에 따라 정정될 수 있습니다.
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/reports/new" className="hover:text-ink">
              제보하기
            </Link>
            <Link href="/clips/new" className="hover:text-ink">
              클립 제보
            </Link>
            <Link href="/login" className="hover:text-ink">
              운영진
            </Link>
          </div>
        </div>
      </footer>

      <MobileReportButton />
    </div>
  );
}
