import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, contentFlags, users } from "@/db/schema";
import { countPending } from "@/server/admin";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission, ROLE_LABELS } from "@/lib/auth/permissions";
import { AdminTitle } from "@/components/admin/guard";
import { FlagActions } from "@/components/admin/FlagActions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "대시보드" };

export default async function AdminDashboard() {
  const session = (await getCurrentSession())!;
  const db = await getDb();
  const [pending, flags, logs] = await Promise.all([
    countPending(db),
    hasPermission(session.roles, "flags.manage") ? db.select().from(contentFlags).where(eq(contentFlags.status, "OPEN")).orderBy(desc(contentFlags.createdAt)).limit(20) : [],
    hasPermission(session.roles, "audit.view")
      ? db
          .select({ log: auditLogs, userName: users.displayName })
          .from(auditLogs)
          .leftJoin(users, eq(users.id, auditLogs.userId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(40)
      : [],
  ]);

  const cards = [
    { href: "/admin/control-room", title: "방송 지통실", desc: "제보·사건·속보·큐시트·OBS를 한 화면에서", hot: true },
    { href: "/admin/reports", title: "제보 검토", desc: `대기 ${pending.reports}건` },
    { href: "/admin/clips", title: "클립 검토", desc: `대기 ${pending.clips}건` },
    { href: "/admin/breaking", title: "속보", desc: "즉시·예약 송출, 정정·종료" },
    { href: "/admin/episodes", title: "뉴스 회차", desc: "큐시트·대본·프롬프터" },
    { href: "/admin/overlays", title: "OBS 송출", desc: "오버레이 모드·미리보기" },
  ];

  return (
    <>
      <AdminTitle title={`${session.displayName}님, 반갑습니다`} desc={`역할: ${session.roles.map((r) => ROLE_LABELS[r]).join(", ")}`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={`panel p-4 hover:border-[#3a4a68] ${c.hot ? "border-alert/60" : ""}`}>
            <div className="text-lg font-bold">{c.title}</div>
            <div className="text-sm text-muted">{c.desc}</div>
          </Link>
        ))}
      </div>

      {flags.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold">사용자 신고 ({pending.flags})</h2>
          <ul className="panel divide-y divide-line">
            {flags.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="font-mono text-xs text-dim">{fmtDateTime(f.createdAt)}</span>
                <span className="text-xs text-muted">
                  {f.targetType}{" "}
                  {f.targetType === "article" && (
                    <Link href={`/admin/articles/${f.targetId}`} className="underline">
                      열기
                    </Link>
                  )}
                </span>
                <span className="flex-1">{f.reason}</span>
                <FlagActions id={f.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {logs.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-bold">감사 로그 (최근 40건)</h2>
          <div className="panel overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-dim">
                <tr>
                  <th className="p-2">시각</th>
                  <th className="p-2">사용자</th>
                  <th className="p-2">작업</th>
                  <th className="p-2">대상</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map(({ log, userName }) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap p-2 font-mono text-dim">{fmtDateTime(log.createdAt)}</td>
                    <td className="p-2">{userName ?? "-"}</td>
                    <td className="p-2 font-mono">{log.action}</td>
                    <td className="p-2 text-muted">
                      {log.entityType} {log.entityId?.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
