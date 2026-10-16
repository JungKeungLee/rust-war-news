/**
 * RWN E2E 시나리오 테스트 (실행 중인 서버에 HTTP 요청)
 *   E2E_BASE=http://localhost:3100 ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/e2e.mjs
 * 서버는 시드(마이그레이션·초기 관리자·진행자·데모 데이터)가 끝난 상태여야 한다.
 */
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@rwn.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe12345";
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const results = [];
let current = null;

function scenario(no, title) {
  current = { no, title, checks: [], ok: true };
  results.push(current);
  console.log(`\n[${no}] ${title}`);
}
function check(cond, label, detail) {
  current.checks.push({ label, ok: !!cond });
  if (!cond) current.ok = false;
  console.log(`  ${cond ? "✔" : "✘"} ${label}${!cond && detail !== undefined ? ` → ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}` : ""}`);
  return !!cond;
}

/** 쿠키를 유지하는 간단한 클라이언트 */
function client(ip) {
  const jar = new Map();
  let csrf = null;
  async function req(method, path, { json, form, headers = {}, raw = false, origin = BASE, redirect = "manual" } = {}) {
    const h = { origin, "x-forwarded-for": ip, ...headers };
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    if (csrf && method !== "GET" && !("x-csrf-token" in headers)) h["x-csrf-token"] = csrf;
    let body;
    if (json !== undefined) {
      h["content-type"] = "application/json";
      body = JSON.stringify(json);
    } else if (form) body = form;
    const res = await fetch(BASE + path, { method, headers: h, body, redirect });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (v) jar.set(k, v);
      else jar.delete(k);
    }
    if (raw) return res;
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    req,
    get: (p, o) => req("GET", p, o),
    post: (p, json, o = {}) => req("POST", p, { ...o, json }),
    patch: (p, json, o = {}) => req("PATCH", p, { ...o, json }),
    put: (p, json, o = {}) => req("PUT", p, { ...o, json }),
    del: (p, o) => req("DELETE", p, o),
    async login(email, password) {
      const r = await req("POST", "/api/auth/login", { json: { email, password } });
      if (r.status !== 200) throw new Error(`로그인 실패 ${email}: ${r.status} ${JSON.stringify(r.data)}`);
      const me = await req("GET", "/api/auth/me");
      csrf = me.data.csrfToken;
      return me.data.user;
    },
    jar,
  };
}

async function main() {
  const viewer = client("203.0.113.10");
  const adminA = client("198.51.100.1");
  const adminB = client("198.51.100.2");
  const anchorC = client("198.51.100.3");
  const anon = client("198.51.100.9");
  const stamp = Date.now().toString(36);

  // ---------- 준비: 관리자 2명 + 진행자 ----------
  await adminA.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const users = (await adminA.get("/api/admin/users")).data.users;
  const anchors = users.filter((u) => u.roles.includes("ANCHOR"));
  const nan = anchors.find((u) => u.displayName === "난워니");
  const kim = anchors.find((u) => u.displayName === "김옥독");
  if (!nan || !kim) throw new Error("진행자 계정(난워니, 김옥독)이 필요합니다. db:seed-anchors 를 먼저 실행하세요.");
  const editor2Email = `editor2-${stamp}@rwn.local`;
  await adminA.post("/api/admin/users", { email: editor2Email, displayName: "편집자2", password: "Editor2Pass99", roles: ["EDITOR", "OPERATOR"], color: "#22c55e" });
  await adminB.login(editor2Email, "Editor2Pass99");
  if ((await adminB.post("/api/account/password", { currentPassword: "Editor2Pass99", newPassword: "DeskEditor2025" })).status !== 200) throw new Error("편집자2 비밀번호 변경 실패");
  await adminA.patch(`/api/admin/users/${nan.id}`, { password: "NanwonyPass99" });
  await anchorC.login(nan.email, "NanwonyPass99");
  // 관리자가 재설정한 비밀번호는 임시 비밀번호 → 본인이 먼저 변경해야 다른 기능 사용 가능
  const pc = await anchorC.post("/api/account/password", { currentPassword: "NanwonyPass99", newPassword: "AnchorDesk2025" });
  if (pc.status !== 200) throw new Error(`진행자 비밀번호 변경 실패: ${pc.status} ${JSON.stringify(pc.data)}`);
  const teamsData = (await adminA.get("/api/admin/teams")).data;
  const activeEvent = teamsData.events.find((e) => e.isActive);
  const team1 = teamsData.teams.find((t) => t.eventId === activeEvent.id);

  // ---------- 1 ----------
  scenario(1, "일반 시청자가 제보 등록");
  const title = `<b>북부 해안 기지</b> 대규모 레이드 ${stamp}`;
  const fd = new FormData();
  fd.set("type", "RAID");
  fd.set("title", title);
  fd.set("body", "북부 연합이 해안 방위대 기지를 기습했습니다. <script>alert(1)</script> 좌표는 비공개.");
  fd.set("occurredAt", new Date(Date.now() - 600000).toISOString());
  fd.set("videoUrl", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  fd.set("nickname", "제보왕");
  fd.append("teamIds", team1.id);
  fd.set("elapsedMs", "8000");
  fd.append("images", new Blob([PNG_1PX], { type: "image/png" }), "evidence.png");
  let r = await viewer.req("POST", "/api/reports", { form: fd });
  check(r.status === 200 && r.data.receipt, "제보 접수 200 + 접수번호", r.data);
  const cleanTitle = title.replace(/<\/?b>/g, "");

  const bad1 = new FormData();
  for (const [k, v] of fd.entries()) if (k !== "images") bad1.append(k, v);
  bad1.set("title", `악성 이미지 테스트 ${stamp}`);
  bad1.append("images", new Blob([Buffer.from("<svg onload=alert(1)>not an image</svg>")], { type: "image/png" }), "x.png");
  r = await viewer.req("POST", "/api/reports", { form: bad1 });
  check(r.status === 415, "이미지로 위장한 파일 거부(415)", r);
  const bad2 = new FormData();
  for (const [k, v] of fd.entries()) if (k !== "images") bad2.append(k, v);
  bad2.set("title", `URL 테스트 ${stamp}`);
  bad2.set("videoUrl", "javascript:alert(1)");
  r = await viewer.req("POST", "/api/reports", { form: bad2 });
  check(r.status === 400, "javascript: URL 거부(400)", r);
  const bot = new FormData();
  for (const [k, v] of fd.entries()) if (k !== "images") bot.append(k, v);
  bot.set("elapsedMs", "300");
  bot.set("title", `봇 테스트 ${stamp}`);
  r = await anon.req("POST", "/api/reports", { form: bot });
  check(r.status === 400, "2초 미만 자동 제출 거부(400)", r);

  r = await viewer.get("/reports");
  check(r.status === 200 && !r.data.includes(cleanTitle), "승인 전 제보는 공개 목록에 없음");

  // ---------- 2 ----------
  scenario(2, "관리자에게 새 제보 표시");
  r = await adminA.get("/api/admin/reports?status=RECEIVED,REVIEWING");
  const report = r.data.reports?.find((x) => x.title === cleanTitle);
  check(!!report, "관리자 대기 목록에 새 제보 존재", r.data);
  check(report && !report.title.includes("<") && !report.body.includes("<script"), "HTML/스크립트 제거되어 저장");
  check(report && report.images.length === 1, "증거 이미지 1장 첨부");
  check(report && report.submitterIpHash === undefined, "제보자 IP 해시는 관리자 API에도 노출 안 함");
  const imgUrl = report?.images[0];
  r = await anon.req("GET", imgUrl, { raw: true });
  check(r.status === 404, "승인 전 증거 이미지는 비로그인 접근 불가", r.status);
  r = await adminA.req("GET", imgUrl, { raw: true });
  check(r.status === 200 && r.headers.get("content-type") === "image/png" && r.headers.get("x-content-type-options") === "nosniff", "관리자는 증거 이미지 열람 (MIME·nosniff 확인)");

  // ---------- 3 ----------
  scenario(3, "관리자가 제보 검토");
  r = await adminA.patch(`/api/admin/reports/${report.id}`, { version: report.version, action: "review" });
  check(r.status === 200 && r.data.report.status === "REVIEWING", "상태: 접수 → 확인 중", r.data);
  let rep = r.data.report;
  r = await adminA.patch(`/api/admin/reports/${report.id}`, { version: rep.version, action: "reject" });
  check(r.status === 400, "반려 시 사유 필수", r.data);

  // ---------- 4 ----------
  scenario(4, "제보와 사건 연결");
  r = await adminA.post(`/api/admin/reports/${report.id}/incident`, { version: rep.version, eventId: activeEvent.id });
  check(r.status === 200 && r.data.incident?.id, "제보로부터 사건 생성·연결", r.data);
  const incident = r.data.incident;
  r = await adminA.get(`/api/admin/incidents/${incident.id}`);
  check(r.data.reports?.some((x) => x.id === report.id), "사건 상세에 연결 제보 표시");
  check(r.data.incident.teamIds.includes(team1.id), "제보의 관련 팀이 사건에 연결됨");
  r = await adminA.patch(`/api/admin/incidents/${incident.id}`, {
    version: r.data.incident.version,
    title: incident.title,
    type: "RAID",
    eventId: activeEvent.id,
    summary: "북부 연합의 해안 기지 기습",
    occurredAt: incident.occurredAt,
    verificationStatus: "CONFIRMED",
    isPublic: true,
    publishAt: null,
    isSensitive: false,
    isClosed: false,
    teamIds: [team1.id],
  });
  check(r.status === 200 && r.data.incident.verificationStatus === "CONFIRMED", "사건 확인 완료 + 공개 설정", r.data);
  rep = (await adminA.get("/api/admin/reports?status=REVIEWING")).data.reports.find((x) => x.id === report.id);
  r = await adminA.patch(`/api/admin/reports/${report.id}`, { version: rep.version, action: "approve", incidentId: incident.id });
  check(r.status === 200 && r.data.report.status === "APPROVED", "제보 승인", r.data);
  r = await viewer.get("/reports");
  check(r.data.includes(cleanTitle) && r.data.includes("제보왕"), "승인 후 공개 제보 목록에 표시");
  r = await anon.req("GET", imgUrl, { raw: true });
  check(r.status === 200, "승인 후 증거 이미지 공개", r.status);
  r = await viewer.get("/war-room");
  check(r.data.includes(incident.title), "전쟁 상황판에 공개 사건 표시");

  // ---------- 5 ----------
  scenario(5, "사건 기반 속보 작성");
  const bTitle = `[속보] 해안 기지 함락 ${stamp}`;
  r = await adminA.post("/api/admin/breaking", {
    title: bTitle,
    body: "해안 방위대 기지가 함락됐습니다.",
    priority: "URGENT",
    verificationStatus: "CONFIRMED",
    incidentId: incident.id,
    isPinned: false,
    showOnOverlay: true,
    startsAt: null,
    endsAt: null,
    publish: "now",
  });
  check(r.status === 200 && r.data.breaking.status === "LIVE", "속보 즉시 송출", r.data);
  let breaking = r.data.breaking;
  r = await adminA.get(`/api/admin/incidents/${incident.id}`);
  check(r.data.breaking.some((b) => b.id === breaking.id), "사건에 속보 연결");

  // ---------- 6 ----------
  scenario(6, "속보 발행 시 공개 페이지 갱신");
  r = await viewer.get("/api/live");
  check(r.data.breaking?.some((b) => b.title === bTitle), "/api/live (폴링 엔드포인트)에 속보 포함", r.data);
  r = await viewer.get("/");
  check(r.data.includes(bTitle), "메인 화면 렌더에 속보 포함");
  r = await viewer.get("/breaking");
  check(r.data.includes(bTitle), "/breaking 페이지에 속보 포함");
  const schedTitle = `예약 속보 ${stamp}`;
  r = await adminA.post("/api/admin/breaking", {
    title: schedTitle, body: null, priority: "NORMAL", verificationStatus: "UNVERIFIED", incidentId: incident.id,
    isPinned: false, showOnOverlay: true, startsAt: new Date(Date.now() + 3600_000).toISOString(), endsAt: null, publish: "schedule",
  });
  check(r.status === 200 && r.data.breaking.status === "SCHEDULED", "예약 발행 생성", r.data);
  r = await viewer.get("/api/live");
  check(!r.data.breaking.some((b) => b.title === schedTitle), "예약 시각 전에는 공개되지 않음");
  const expTitle = `자동종료 속보 ${stamp}`;
  r = await adminA.post("/api/admin/breaking", {
    title: expTitle, body: null, priority: "NORMAL", verificationStatus: "UNVERIFIED", incidentId: null,
    isPinned: false, showOnOverlay: false, startsAt: null, endsAt: new Date(Date.now() + 2500).toISOString(), publish: "now",
  });
  r = await viewer.get("/api/live");
  check(r.data.breaking.some((b) => b.title === expTitle), "종료 시각 전에는 노출");
  await new Promise((res) => setTimeout(res, 3000));
  r = await viewer.get("/api/live");
  check(!r.data.breaking.some((b) => b.title === expTitle), "노출 종료 시각 경과 후 자동 종료");

  // ---------- 7 ----------
  scenario(7, "OBS 속보 오버레이 갱신");
  r = await anon.get("/api/overlay/breaking");
  check(r.data.state?.visible === true && r.data.state.item?.title === bTitle, "오버레이 상태에 속보 표시", r.data);
  r = await anon.get("/overlay/breaking");
  check(r.status === 200 && !r.data.includes("제보하기") && r.data.includes("background: transparent"), "오버레이 페이지: 사이트 메뉴 없음 + 투명 배경");
  const corrected = `${bTitle} (정정)`;
  r = await adminA.patch(`/api/admin/breaking/${breaking.id}`, { action: "correct", version: breaking.version, title: corrected, body: "정정된 내용", verificationStatus: "CONFIRMED", note: "피해 규모 정정" });
  check(r.status === 200 && r.data.breaking.correctedAt, "송출 중 속보 정정", r.data);
  breaking = r.data.breaking;
  r = await anon.get("/api/overlay/breaking");
  check(r.data.state.item?.title === corrected && r.data.state.item.correctedAt, "오버레이에 정정 내용 반영");
  r = await adminA.get(`/api/admin/breaking/${breaking.id}`);
  check(r.data.revisions.some((x) => x.title === bTitle) && r.data.revisions.some((x) => x.action === "CORRECT"), "정정 이력에 원문 보존");

  // ---------- 8 ----------
  scenario(8, "속보 종료 시 방송 화면 제거");
  r = await adminA.patch(`/api/admin/breaking/${breaking.id}`, { action: "end", version: breaking.version });
  check(r.status === 200 && r.data.breaking.status === "ENDED", "속보 종료", r.data);
  breaking = r.data.breaking;
  r = await anon.get("/api/overlay/breaking");
  check(r.data.state.visible === false && r.data.state.item === null, "OBS 오버레이에서 제거", r.data);
  r = await viewer.get("/api/live");
  check(!r.data.breaking.some((b) => b.id === breaking.id), "공개 실시간 목록에서 제거");

  // ---------- 9 ----------
  scenario(9, "동일 사건으로 정규 뉴스 기사 작성");
  r = await adminA.post(`/api/admin/breaking/${breaking.id}/convert`);
  check(r.status === 200 && r.data.article.sourceBreakingId === breaking.id, "속보 → 기사 초안 전환", r.data);
  const converted = r.data.article;
  r = await adminA.get(`/api/admin/breaking/${breaking.id}`);
  check(r.data.breaking.title === corrected && r.data.breaking.status === "ENDED" && r.data.breaking.convertedArticleId === converted.id, "원본 속보 유지 + 기사 링크");
  const aTitle = `해안 기지 함락, 전선 북상 ${stamp}`;
  r = await adminA.post("/api/admin/articles", {
    title: aTitle,
    lead: "북부 연합이 해안 기지를 장악했다.",
    body: "첫 문단입니다.\n\n둘째 문단 <img src=x onerror=alert(1)> 입니다.",
    status: "PUBLISHED",
    verificationStatus: "CONFIRMED",
    isFeatured: true,
    coverUrl: null,
    incidentId: incident.id,
  });
  check(r.status === 200 && r.data.article.status === "PUBLISHED", "사건 연결 기사 발행", r.data);
  let article = r.data.article;
  r = await viewer.get(`/news/${article.id}`);
  check(r.status === 200 && r.data.includes(aTitle) && !r.data.includes("<img src=x"), "공개 기사 페이지 (HTML 제거)");
  r = await adminA.get("/api/admin/reports?status=PUBLISHED");
  check(r.data.reports.some((x) => x.id === report.id), "제보 상태가 '기사화'로 전환");
  r = await viewer.get(`/news/${converted.id}`);
  check(r.status === 404, "초안 기사는 공개되지 않음(404)", r.status);

  // ---------- 10 ----------
  scenario(10, "기사와 클립 연결");
  const clipTitle = `기지 함락 순간 클립 ${stamp}`;
  r = await viewer.post("/api/clips", { title: clipTitle, url: `https://youtu.be/dQw4w9WgXcQ?t=${stamp.length}`, description: null, teamId: team1.id, playerId: null, nickname: "클립러", isAnonymous: false, elapsedMs: 5000 });
  check(r.status === 200, "시청자 클립 제보", r.data);
  r = await adminA.get("/api/admin/clips");
  const clip = r.data.items.find((c) => c.title === clipTitle);
  check(clip && clip.status === "PENDING" && clip.embedUrl?.startsWith("https://www.youtube-nocookie.com/embed/"), "YouTube 임베드 URL 자동 생성 + 승인 대기", clip);
  r = await viewer.get("/clips");
  check(!r.data.includes(clipTitle), "승인 전 클립 비공개");
  r = await adminA.patch(`/api/admin/clips/${clip.id}`, { version: clip.version, action: "approve" });
  r = await adminA.patch(`/api/admin/clips/${clip.id}`, { version: r.data.clip.version, action: "update", isHot: true });
  check(r.status === 200 && r.data.clip.isHot, "승인 + 핫 클립 선정", r.data);
  r = await adminA.patch(`/api/admin/clips/${clip.id}`, { version: r.data.clip.version, action: "update", embedUrl: "https://evil.example.com/embed" });
  check(r.status === 400, "허용되지 않은 임베드 도메인 거부", r.data);
  r = await adminA.patch(`/api/admin/articles/${article.id}`, {
    version: article.version, title: article.title, lead: article.lead, body: article.body, status: "PUBLISHED",
    verificationStatus: "CONFIRMED", isFeatured: true, coverUrl: null, incidentId: incident.id, clipIds: [clip.id], note: "클립 연결",
  });
  check(r.status === 200, "기사에 클립 연결", r.data);
  article = r.data.article;
  r = await viewer.get(`/news/${article.id}`);
  check(r.data.includes(clipTitle) && r.data.includes("youtube-nocookie.com/embed"), "공개 기사에 클립 임베드 표시");
  r = await viewer.get("/clips?hot=1");
  check(r.data.includes(clipTitle), "핫 클립 목록 표시");

  // ---------- 11 ----------
  scenario(11, "방송 회차 생성");
  const epTitle = `RWN 저녁 뉴스 ${stamp}`;
  r = await adminA.post("/api/admin/episodes", { title: epTitle, number: 1, scheduledAt: new Date(Date.now() + 1800_000).toISOString(), eventId: activeEvent.id, liveUrl: "https://www.sooplive.co.kr/", replayUrl: null, anchorIds: [nan.id, kim.id] });
  check(r.status === 200, "회차 생성 (진행자: 난워니, 김옥독)", r.data);
  const epId = r.data.episode.id;
  r = await adminA.post("/api/admin/episodes", { title: "잘못된 진행자", number: null, scheduledAt: null, eventId: null, liveUrl: null, replayUrl: null, anchorIds: [users.find((u) => !u.roles.includes("ANCHOR")).id] });
  check(r.status === 400, "ANCHOR 역할이 없는 계정은 진행자 배정 불가", r.data);
  r = await anon.get("/api/overlay/standby");
  check(r.data.state.visible && r.data.state.title, "대기 화면 오버레이에 다음 회차 표시", r.data);

  // ---------- 12 ----------
  scenario(12, "큐시트 순서 변경");
  let ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  const add = async (body) => {
    const res = await adminA.post(`/api/admin/episodes/${epId}/rundown`, { episodeVersion: ep.episode.version, breakingId: null, notes: null, ...body });
    ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
    return res;
  };
  r = await add({ kind: "SEGMENT", title: "오프닝", articleId: null, clipId: null, anchorId: nan.id, plannedSeconds: 30 });
  check(r.status === 200, "큐시트 항목 추가(오프닝)", r.data);
  await add({ kind: "ARTICLE", title: aTitle, articleId: article.id, clipId: null, anchorId: kim.id, plannedSeconds: 120 });
  await add({ kind: "CLIP", title: clipTitle, articleId: null, clipId: clip.id, anchorId: nan.id, plannedSeconds: 45 });
  check(ep.items.length === 3, "기사·클립·코너 3개 항목", ep.items.length);
  const newOrder = [ep.items[1].id, ep.items[0].id, ep.items[2].id];
  r = await adminA.put(`/api/admin/episodes/${epId}/rundown`, { episodeVersion: ep.episode.version, order: newOrder });
  check(r.status === 200, "순서 변경 요청", r.data);
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  check(ep.items.map((i) => i.id).join() === newOrder.join(), "변경된 순서 반영");

  // ---------- 13 ----------
  scenario(13, "난워니와 김옥독 대본 분리");
  const item0 = ep.items[0];
  r = await adminA.put(`/api/admin/rundown/${item0.id}/script`, { anchorId: nan.id, body: "난워니: 안녕하십니까, RWN 저녁 뉴스입니다.", version: null });
  check(r.status === 200, "난워니 대본 저장", r.data);
  r = await adminA.put(`/api/admin/rundown/${item0.id}/script`, { anchorId: kim.id, body: "김옥독: 첫 소식입니다.", version: null });
  check(r.status === 200, "김옥독 대본 저장", r.data);
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  const sc = ep.items[0].scripts;
  check(sc.length === 2 && sc.find((s) => s.anchorId === nan.id).body.startsWith("난워니") && sc.find((s) => s.anchorId === kim.id).body.startsWith("김옥독"), "같은 항목에 진행자별 대본이 분리 저장");
  r = await anchorC.put(`/api/admin/rundown/${item0.id}/script`, { anchorId: kim.id, body: "남의 대본 수정 시도", version: sc.find((s) => s.anchorId === kim.id).version });
  check(r.status === 403, "진행자(난워니)는 김옥독 대본 수정 불가(403)", r.data);
  r = await anchorC.put(`/api/admin/rundown/${item0.id}/script`, { anchorId: nan.id, body: "난워니: 수정한 오프닝 멘트", version: sc.find((s) => s.anchorId === nan.id).version });
  check(r.status === 200, "진행자 본인 대본 수정 가능", r.data);
  r = await anchorC.get(`/admin/episodes/${epId}/prompter`);
  check(r.status === 200 && r.data.includes("수정한 오프닝 멘트"), "프롬프터 화면 렌더(진행자 본인)");

  // ---------- 14 ----------
  scenario(14, "관리자 두 명 동시 변경 처리");
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  const v = ep.episode.version;
  const orderA = ep.items.map((i) => i.id).reverse();
  const orderB = [ep.items[2].id, ep.items[0].id, ep.items[1].id];
  const [ra, rb] = await Promise.all([
    adminA.put(`/api/admin/episodes/${epId}/rundown`, { episodeVersion: v, order: orderA }),
    adminB.put(`/api/admin/episodes/${epId}/rundown`, { episodeVersion: v, order: orderB }),
  ]);
  const statuses = [ra.status, rb.status].sort();
  check(statuses[0] === 200 && statuses[1] === 409, "동시 큐시트 순서 변경: 1건 성공, 1건 409 충돌", [ra.status, rb.status]);
  const winner = ra.status === 200 ? orderA : orderB;
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  check(ep.items.map((i) => i.id).join() === winner.join(), "성공한 변경만 반영 (덮어쓰기 없음)");
  const [aa, ab] = await Promise.all([
    adminA.patch(`/api/admin/articles/${article.id}`, { version: article.version, title: `${aTitle} (A수정)`, lead: article.lead, body: article.body, status: "PUBLISHED", verificationStatus: "CONFIRMED", isFeatured: true, coverUrl: null, incidentId: incident.id }),
    adminB.patch(`/api/admin/articles/${article.id}`, { version: article.version, title: `${aTitle} (B수정)`, lead: article.lead, body: article.body, status: "PUBLISHED", verificationStatus: "CONFIRMED", isFeatured: true, coverUrl: null, incidentId: incident.id }),
  ]);
  check([aa.status, ab.status].sort().join() === "200,409", "동시 기사 수정: 1건 성공, 1건 409", [aa.status, ab.status]);
  check((aa.status === 409 ? aa : ab).data.current?.version === article.version + 1, "409 응답에 최신 버전 포함");
  r = await adminA.get(`/api/admin/articles/${article.id}`);
  check(r.data.revisions.length >= 3, "기사 수정 이력 누적", r.data.revisions?.length);
  article = r.data.article;

  // ---------- 15 ----------
  scenario(15, "정규 뉴스 방송 진행 및 종료");
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  r = await adminA.patch(`/api/admin/episodes/${epId}`, { action: "start", version: ep.episode.version, syncLive: true });
  check(r.status === 200 && r.data.episode.status === "LIVE", "방송 시작", r.data);
  r = await viewer.get("/api/live");
  check(r.data.live.isLive === true && r.data.live.url === "https://www.sooplive.co.kr/", "사이트 LIVE 표시 + 방송 링크", r.data.live);
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  const [c1, c2] = await Promise.all([
    adminA.post(`/api/admin/episodes/${epId}/cue`, { action: "next", expectedCurrentId: null }),
    adminB.post(`/api/admin/episodes/${epId}/cue`, { action: "next", expectedCurrentId: null }),
  ]);
  check([c1.status, c2.status].sort().join() === "200,409", "동시 '다음' 진행: 1건만 적용 (중복 진행 방지)", [c1.status, c2.status]);
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  check(ep.episode.currentItemId === ep.items[0].id && ep.items[0].status === "ON_AIR", "첫 항목 ON AIR");
  r = await anon.get("/api/overlay/lower_third");
  check(r.data.state.visible && [nan.displayName, kim.displayName].includes(r.data.state.name), "하단 자막에 현재 진행자 표시", r.data.state);
  r = await anon.get("/api/overlay/headline");
  check(r.data.state.visible && r.data.state.title === ep.items[0].title, "헤드라인 오버레이 = 현재 큐 항목", r.data.state);
  r = await adminA.patch(`/api/admin/rundown/${ep.items[0].id}`, { version: ep.items[0].version, anchorId: ep.items[0].anchorId === nan.id ? kim.id : nan.id });
  check(r.status === 200, "진행자 전환", r.data);
  r = await adminA.post(`/api/admin/episodes/${epId}/cue`, { action: "next", expectedCurrentId: ep.episode.currentItemId });
  check(r.status === 200, "다음 항목 진행", r.data);
  r = await adminA.get("/api/admin/control-room");
  check(r.status === 200 && r.data.episode?.episode.id === epId && r.data.stats, "지통실 스냅샷에 진행 중 회차·통계");
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  r = await adminA.patch(`/api/admin/episodes/${epId}`, { action: "end", version: ep.episode.version, syncLive: true, publishArchive: true });
  check(r.status === 200 && r.data.episode.status === "ENDED", "방송 종료", r.data);
  r = await viewer.get("/api/live");
  check(r.data.live.isLive === false, "사이트 LIVE 표시 해제");
  ep = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  check(ep.items.every((i) => i.status !== "ON_AIR") && ep.episode.currentItemId === null, "진행 중 항목 정리");

  // ---------- 16 ----------
  scenario(16, "아카이브 공개");
  r = await viewer.get("/archive");
  check(r.data.includes(epTitle), "아카이브 페이지에 종료 회차 공개");
  r = await adminA.patch(`/api/admin/episodes/${epId}`, { action: "archive", version: ep.episode.version, isPublic: false });
  r = await viewer.get("/archive");
  check(!r.data.includes(epTitle), "아카이브 비공개 전환 시 숨김");
  r = await adminA.patch(`/api/admin/episodes/${epId}`, { action: "archive", version: r.status ? (await adminA.get(`/api/admin/episodes/${epId}`)).data.episode.version : 0, isPublic: true });
  check(r.status === 200, "다시 공개");

  // ---------- 17 ----------
  // ---------- 계정 보안 ----------
  scenario("S1", "임시 비밀번호 최초 로그인 시 변경 강제");
  const tmpEmail = `newanchor-${stamp}@rwn.local`;
  r = await adminA.post("/api/admin/users", { email: tmpEmail, displayName: `신규진행자${stamp}`, password: "TempPass2025", roles: ["ANCHOR"], color: "#eab308" });
  check(r.status === 200, "관리자가 임시 비밀번호로 계정 생성", r.data);
  const newbie = client("198.51.100.20");
  const newbie2 = client("198.51.100.21");
  r = await newbie.post("/api/auth/login", { email: tmpEmail, password: "TempPass2025" });
  check(r.status === 200 && r.data.mustChangePassword === true, "로그인 응답에 비밀번호 변경 필요 표시", r.data);
  await newbie.login(tmpEmail, "TempPass2025");
  await newbie2.login(tmpEmail, "TempPass2025");
  r = await newbie.get("/api/admin/control-room");
  check(r.status === 403 && r.data.code === "PASSWORD_CHANGE_REQUIRED", "변경 전 관리자 API 차단(403)", r.data);
  r = await newbie.req("GET", "/admin/control-room", { raw: true });
  check([302, 303, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").includes("/account/password"), "변경 전 관리자 화면 → 비밀번호 변경 화면으로 이동", [r.status, r.headers.get("location")]);
  r = await newbie.get("/account/password");
  check(r.status === 200 && r.data.includes("임시 비밀번호"), "비밀번호 변경 화면 표시");
  r = await newbie.post("/api/account/password", { currentPassword: "WrongPass2025", newPassword: "BrandNew2025x" });
  check(r.status === 400, "현재 비밀번호 틀리면 거부", r.data);
  r = await newbie.post("/api/account/password", { currentPassword: "TempPass2025", newPassword: "short1" });
  check(r.status === 400, "약한 새 비밀번호 거부", r.data);
  r = await newbie.post("/api/account/password", { currentPassword: "TempPass2025", newPassword: "TempPass2025" });
  check(r.status === 400, "이전과 같은 비밀번호 거부", r.data);
  r = await newbie.post("/api/account/password", { currentPassword: "TempPass2025", newPassword: "BrandNew2025x" }, { headers: { "x-csrf-token": "" } });
  check(r.status === 403, "CSRF 토큰 없으면 거부", r.data);
  r = await newbie.post("/api/account/password", { currentPassword: "TempPass2025", newPassword: "BrandNew2025x" });
  check(r.status === 200, "비밀번호 변경 성공", r.data);
  r = await newbie.get("/api/admin/control-room");
  check(r.status === 200, "변경 후 관리자 기능 사용 가능", r.status);
  r = await newbie2.get("/api/auth/me");
  check(r.status === 401, "다른 기기 세션은 종료됨", r.status);
  r = await client("198.51.100.22").post("/api/auth/login", { email: tmpEmail, password: "TempPass2025" });
  check(r.status === 401, "옛 임시 비밀번호로 로그인 불가", r.status);
  r = await client("198.51.100.23").post("/api/auth/login", { email: tmpEmail, password: "BrandNew2025x" });
  check(r.status === 200 && r.data.mustChangePassword === false, "새 비밀번호로 로그인, 변경 요구 해제", r.data);

  scenario("S2", "관리자 비밀번호 재설정 점검");
  const usersNow = (await adminA.get("/api/admin/users")).data.users;
  const newbieUser = usersNow.find((u) => u.email === tmpEmail);
  check(newbieUser && JSON.stringify(newbieUser).indexOf("passwordHash") === -1 && JSON.stringify(newbieUser).indexOf("scrypt$") === -1, "계정 목록 응답에 비밀번호 해시 없음");
  r = await adminA.patch(`/api/admin/users/${newbieUser.id}`, { password: "weak" });
  check(r.status === 400, "재설정 비밀번호도 정책 적용", r.data);
  r = await adminA.patch(`/api/admin/users/${newbieUser.id}`, { password: "ResetPass2025" });
  check(r.status === 200, "관리자 재설정 성공", r.data);
  r = await newbie.get("/api/auth/me");
  check(r.status === 401, "재설정 시 대상 계정 기존 세션 모두 종료", r.status);
  r = await client("198.51.100.24").post("/api/auth/login", { email: tmpEmail, password: "ResetPass2025" });
  check(r.status === 200 && r.data.mustChangePassword === true, "재설정 비밀번호는 임시 → 다음 로그인 시 변경 요구", r.data);
  r = await adminB.patch(`/api/admin/users/${newbieUser.id}`, { password: "Hijack2025xx" });
  check(r.status === 403, "SUPER_ADMIN 아닌 편집자는 재설정 불가", r.status);

  scenario("S3", "이메일 변경 + 기존 연결 유지 (김옥독 예시 이메일 교체)");
  const kimBefore = (await adminA.get("/api/admin/users")).data.users.find((u) => u.id === kim.id);
  const kimNewEmail = `kimokdok-real-${stamp}@rwn.local`;
  r = await adminA.patch(`/api/admin/users/${kim.id}`, { email: kimNewEmail.toUpperCase() });
  check(r.status === 200, "김옥독 이메일 변경 (대문자 입력 → 소문자 저장)", r.data);
  const kimAfter = (await adminA.get("/api/admin/users")).data.users.find((u) => u.id === kim.id);
  check(kimAfter.email === kimNewEmail && kimAfter.id === kimBefore.id && kimAfter.roles.join() === kimBefore.roles.join(), "계정 ID·역할 유지, 새 이메일 저장");
  r = await adminA.patch(`/api/admin/users/${newbieUser.id}`, { email: kimNewEmail.toUpperCase() });
  check(r.status === 409, "다른 계정과 같은 이메일(대소문자 무시) 거부", r.data);
  r = await adminA.patch(`/api/admin/users/${newbieUser.id}`, { email: "not-an-email" });
  check(r.status === 400, "이메일 형식 검증", r.data);
  const epAfter = (await adminA.get(`/api/admin/episodes/${epId}`)).data;
  check(epAfter.anchors.some((a) => a.id === kim.id) && epAfter.items.some((i) => i.anchorId === kim.id && i.anchorName === kim.displayName), "회차 진행자 배정·큐시트 담당 연결 유지");
  check(epAfter.items.some((i) => i.scripts.some((sc) => sc.anchorId === kim.id && sc.body.startsWith("김옥독"))), "김옥독 대본 연결 유지");
  r = await adminA.patch(`/api/admin/users/${kim.id}`, { password: "KimTemp2025x" });
  r = await client("198.51.100.25").post("/api/auth/login", { email: kimNewEmail, password: "KimTemp2025x" });
  check(r.status === 200, "새 이메일로 로그인 가능", r.status);
  r = await client("198.51.100.26").post("/api/auth/login", { email: kimBefore.email, password: "KimTemp2025x" });
  check(r.status === 401, "옛 이메일로는 로그인 불가", r.status);
  r = await viewer.get("/archive");
  check(r.data.includes(epTitle), "공개 아카이브 정상 (연결 데이터 유지)");

  scenario(17, "권한 없는 사용자의 관리자 API 접근 차단");
  r = await anon.get("/api/admin/reports");
  check(r.status === 401, "비로그인 → 401", r.status);
  r = await anon.req("GET", "/admin", { raw: true });
  check([302, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").includes("/login"), "비로그인 /admin → 로그인으로 리다이렉트", r.status);
  r = await anchorC.get("/api/admin/users");
  check(r.status === 403, "진행자 → 계정 관리 API 403", r.status);
  r = await anchorC.post("/api/admin/breaking", { title: "권한 없음", body: null, priority: "NORMAL", verificationStatus: "UNVERIFIED", incidentId: null, isPinned: false, showOnOverlay: true, startsAt: null, endsAt: null, publish: "now" });
  check(r.status === 403, "진행자 → 속보 송출 403", r.status);
  r = await adminA.post("/api/admin/incidents", { title: "CSRF 없음" }, { headers: { "x-csrf-token": "" } });
  check(r.status === 403, "CSRF 토큰 없는 관리자 요청 403", r.data);
  r = await adminA.post("/api/admin/incidents", { title: "외부 출처" }, { origin: "https://evil.example.com" });
  check(r.status === 403, "다른 출처(Origin) 요청 403", r.data);
  r = await adminB.get("/api/admin/users");
  check(r.status === 403, "편집자 → 계정 관리 403", r.status);
  const bad = client("198.51.100.77");
  let locked = false;
  for (let i = 0; i < 7; i++) {
    const lr = await bad.post("/api/auth/login", { email: `nobody-${stamp}@rwn.local`, password: "wrong-password-1" });
    if (lr.status === 429) locked = true;
  }
  check(locked, "로그인 연속 실패 시 잠금(429)");
  const spam = client("203.0.113.55");
  let limited = false;
  for (let i = 0; i < 7; i++) {
    const f2 = new FormData();
    f2.set("type", "OTHER");
    f2.set("title", `도배 ${stamp} ${i}`);
    f2.set("body", "도배 테스트 내용입니다.");
    f2.set("elapsedMs", "5000");
    const sr = await spam.req("POST", "/api/reports", { form: f2 });
    if (sr.status === 429) limited = true;
  }
  check(limited, "제보 도배 요청 제한(429)");
  r = await anon.get("/api/reports");
  check(!JSON.stringify(r.data).includes("submitterIpHash") && !JSON.stringify(r.data).includes("rejectReason"), "공개 제보 API에 IP 해시·반려 사유 미노출");

  // ---------- 투표 ----------
  scenario("+", "시청자 투표 중복 방지");
  r = await adminA.post("/api/admin/polls", { question: `MVP 팀은? ${stamp}`, description: null, resultVisibility: "AFTER_VOTE", startsAt: null, endsAt: null, eventId: null, options: ["북부 연합", "해안 방위대"], open: true });
  check(r.status === 200, "투표 생성·시작", r.data);
  const polls = (await adminA.get("/api/admin/polls")).data.items;
  const poll = polls.find((p) => p.question.endsWith(stamp));
  const voter = client("203.0.113.80");
  r = await voter.post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id });
  check(r.status === 200, "첫 투표 성공", r.data);
  r = await voter.post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[1].id });
  check(r.status === 409, "같은 브라우저 재투표 차단(409)", r.data);
  r = await adminA.patch(`/api/admin/polls/${poll.id}`, { version: poll.version, action: "close" });
  r = await client("203.0.113.81").post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[1].id });
  check(r.status === 409, "종료된 투표 참여 불가", r.data);

  // ---------- 요약 ----------
  console.log("\n================ 결과 요약 ================");
  let failed = 0;
  for (const s of results) {
    const pass = s.checks.filter((c) => c.ok).length;
    console.log(`${s.ok ? "PASS" : "FAIL"}  [${s.no}] ${s.title} (${pass}/${s.checks.length})`);
    if (!s.ok) failed++;
  }
  console.log(`\n시나리오 ${results.length}개 중 실패 ${failed}개`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\n테스트 중단:", e);
  process.exit(2);
});
