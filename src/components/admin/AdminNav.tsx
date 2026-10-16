"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { useAdmin } from "./AdminContext";

const ITEMS: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "대시보드", perm: "admin.access" },
  { href: "/admin/control-room", label: "방송 지통실", perm: "admin.access" },
  { href: "/admin/reports", label: "제보 검토", perm: "reports.review" },
  { href: "/admin/incidents", label: "사건 관리", perm: "incidents.manage" },
  { href: "/admin/breaking", label: "속보 관리", perm: "breaking.manage" },
  { href: "/admin/articles", label: "기사 관리", perm: "articles.manage" },
  { href: "/admin/clips", label: "클립 관리", perm: "clips.manage" },
  { href: "/admin/episodes", label: "뉴스 회차·큐시트", perm: "rundown.operate" },
  { href: "/admin/overlays", label: "OBS 송출", perm: "overlays.manage" },
  { href: "/admin/teams", label: "팀·선수", perm: "teams.manage" },
  { href: "/admin/polls", label: "시청자 투표", perm: "polls.manage" },
  { href: "/admin/users", label: "계정·권한", perm: "users.manage" },
  { href: "/admin/settings", label: "사이트 설정", perm: "settings.manage" },
];

export function AdminNav() {
  const pathname = usePathname();
  const { can } = useAdmin();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible">
      {ITEMS.filter((i) => can(i.perm)).map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`shrink-0 rounded px-3 py-2 text-sm font-semibold ${active ? "bg-alert/15 text-ink ring-1 ring-alert/50" : "text-muted hover:bg-panel2 hover:text-ink"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
