import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { incidents, reportMedia, reports, reportTeams, teams } from "@/db/schema";
import { adminRoute } from "@/lib/api/handler";
import { REPORT_STATUS, type ReportStatus } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";

/** 제보 목록 (관리자). ?status=RECEIVED,REVIEWING&q=검색어 */
export const GET = adminRoute("reports.review", async ({ req, db }) => {
  const sp = req.nextUrl.searchParams;
  const statuses = (sp.get("status") ?? "").split(",").filter((s): s is ReportStatus => (REPORT_STATUS as readonly string[]).includes(s));
  const q = sp.get("q")?.trim().slice(0, 50);
  const conds: SQL[] = [];
  if (statuses.length) conds.push(inArray(reports.status, statuses));
  if (q) conds.push(or(ilike(reports.title, `%${q}%`), ilike(reports.body, `%${q}%`))!);

  const rows = await db
    .select({ report: reports, incidentTitle: incidents.title })
    .from(reports)
    .leftJoin(incidents, eq(incidents.id, reports.incidentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reports.createdAt))
    .limit(100);
  const ids = rows.map((r) => r.report.id);
  const [media, teamRows] = ids.length
    ? await Promise.all([
        db.select().from(reportMedia).where(inArray(reportMedia.reportId, ids)),
        db
          .select({ reportId: reportTeams.reportId, id: teams.id, name: teams.name, color: teams.color })
          .from(reportTeams)
          .innerJoin(teams, eq(teams.id, reportTeams.teamId))
          .where(inArray(reportTeams.reportId, ids)),
      ])
    : [[], []];

  return {
    serverTime: new Date().toISOString(),
    reports: rows.map(({ report, incidentTitle }) => {
      const { submitterIpHash: _ip, ...rest } = report;
      void _ip;
      return {
        ...rest,
        incidentTitle,
        images: media.filter((m) => m.reportId === report.id).map((m) => mediaUrl(m.mediaId)),
        teams: teamRows.filter((t) => t.reportId === report.id).map(({ id, name, color }) => ({ id, name, color })),
      };
    }),
  };
});
