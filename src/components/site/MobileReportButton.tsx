"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 모바일 하단 고정 제보 버튼 (제보 작성 화면에서는 숨김) */
export function MobileReportButton() {
  const pathname = usePathname();
  if (pathname.startsWith("/reports/new") || pathname.startsWith("/clips/new")) return null;
  return (
    <Link
      href="/reports/new"
      className="btn btn-red fixed inset-x-4 bottom-4 z-40 py-3 text-base shadow-[0_8px_24px_rgba(229,32,46,0.35)] sm:hidden"
    >
      📡 제보하기
    </Link>
  );
}
