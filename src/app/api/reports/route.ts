import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { reportMedia, reports, reportTeams, teams } from "@/db/schema";
import { publicRoute } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { MAX_FILES_PER_REPORT, MAX_UPLOAD_BYTES, storeImage } from "@/lib/media";
import { zIncidentType, zLongText, zOptDate, zOptText, zOptUrl, zText } from "@/lib/validation";
import { getSettings } from "@/server/settings";
import { listPublicReports } from "@/server/public";

const ReportInput = z.object({
  type: zIncidentType,
  title: zText(120, 4),
  body: zLongText(4000, 10),
  occurredAt: zOptDate,
  videoUrl: zOptUrl,
  nickname: zOptText(30),
  isAnonymous: z.boolean(),
  teamIds: z.array(z.uuid()).max(10),
});

/** 공개 제보 목록 (승인된 것만) */
export const GET = publicRoute(async ({ db }) => ({ reports: await listPublicReports(db, 40) }));

/** 제보 접수 (multipart/form-data) */
export const POST = publicRoute(async ({ req, db, ipHash }) => {
  const settings = await getSettings(db);
  if (!settings.intake.reportsOpen) throw new ApiError(403, "현재 제보 접수가 중단되어 있습니다.");

  const maxBody = MAX_UPLOAD_BYTES * MAX_FILES_PER_REPORT + 200 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > maxBody) throw new ApiError(413, "첨부 파일 용량이 너무 큽니다.");

  // 도배 방지: IP 기준 10분 5건, 하루 30건
  await rateLimit(db, `report:10m:${ipHash}`, 5, 600);
  await rateLimit(db, `report:1d:${ipHash}`, 30, 86400);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "요청 형식이 올바르지 않습니다.");
  }

  const fakeReceipt = () => ({ ok: true, receipt: Math.random().toString(16).slice(2, 10).toUpperCase() });
  // 봇 함정 필드가 채워졌거나 2초 안에 제출되면 저장하지 않는다.
  if (String(form.get("website") ?? "").trim()) return fakeReceipt();
  if (Number(form.get("elapsedMs") ?? 0) < 2000) throw new ApiError(400, "입력 시간이 너무 짧습니다. 내용을 확인한 뒤 다시 제출하세요.");

  const input = ReportInput.parse({
    type: form.get("type"),
    title: String(form.get("title") ?? ""),
    body: String(form.get("body") ?? ""),
    occurredAt: String(form.get("occurredAt") ?? ""),
    videoUrl: String(form.get("videoUrl") ?? ""),
    nickname: String(form.get("nickname") ?? ""),
    isAnonymous: form.get("isAnonymous") === "1",
    teamIds: [...new Set(form.getAll("teamIds").map(String))],
  });
  if (input.occurredAt && input.occurredAt.getTime() > Date.now() + 10 * 60 * 1000) {
    throw new ApiError(400, "사건 발생 시각이 미래입니다.");
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES_PER_REPORT) throw new ApiError(400, `이미지는 최대 ${MAX_FILES_PER_REPORT}장까지 첨부할 수 있습니다.`);

  // 같은 IP의 같은 제목 10분 내 중복 제보 차단
  const [dup] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.submitterIpHash, ipHash), eq(reports.title, input.title), gt(reports.createdAt, sql`now() - interval '10 minutes'`)))
    .limit(1);
  if (dup) throw new ApiError(409, "같은 제보가 이미 접수되었습니다.");

  const validTeams = input.teamIds.length
    ? await db.select({ id: teams.id }).from(teams).where(and(inArray(teams.id, input.teamIds), eq(teams.isPublic, true)))
    : [];

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(reports)
      .values({
        type: input.type,
        title: input.title,
        body: input.body,
        occurredAt: input.occurredAt,
        videoUrl: input.videoUrl,
        nickname: input.isAnonymous ? null : input.nickname,
        isAnonymous: input.isAnonymous,
        submitterIpHash: ipHash,
      })
      .returning({ id: reports.id });
    if (validTeams.length) await tx.insert(reportTeams).values(validTeams.map((t) => ({ reportId: row.id, teamId: t.id })));
    for (const [i, file] of files.entries()) {
      // 증거 이미지는 비공개로 저장, 제보 승인 시 공개 전환
      const mediaId = await storeImage(tx, file, { isPublic: false, uploaderIpHash: ipHash });
      await tx.insert(reportMedia).values({ reportId: row.id, mediaId, position: i });
    }
    return row.id;
  });

  return { ok: true, receipt: id.slice(0, 8).toUpperCase() };
});
