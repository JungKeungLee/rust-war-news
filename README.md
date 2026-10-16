# RUST WAR NEWS (RWN)

Rust 대결을 위한 시청자 참여형 뉴스 방송 시스템. 진행: 난워니 · 김옥독.
**사건(incident)** 을 중심으로 제보 → 속보 → 정규 기사 → 핫 클립 → 방송 큐시트·대본 → OBS 송출을 하나로 연결합니다.

> 게임 개발사·방송 플랫폼과 무관한 팬 뉴스 사이트입니다.

## 기술 구성

| 영역 | 사용 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| DB | Neon PostgreSQL (운영) / PGlite 내장 Postgres (로컬·테스트) — 같은 Drizzle 코드 |
| ORM·마이그레이션 | Drizzle ORM + drizzle-kit (`drizzle/*.sql`) |
| 인증 | DB 세션(토큰 SHA-256 저장) + HttpOnly·SameSite 쿠키, scrypt 비밀번호 해시, CSRF 토큰 |
| 실시간 | 3~5초 HTTP 폴링 (`src/lib/live/client.ts` 한 곳만 바꾸면 외부 메시징으로 교체 가능) |

## 로컬 실행

```bash
npm install
cp .env.example .env            # AUTH_SECRET, ADMIN_INITIAL_* 채우기 (DATABASE_URL=pglite:./.pglite-dev 그대로 가능)
npm run db:migrate              # 테이블 생성 (비파괴 마이그레이션만 적용)
npm run db:init-admin           # 최초 SUPER_ADMIN 생성 (이미 있으면 건너뜀)
npm run db:seed-anchors         # 진행자 계정(SEED_ANCHORS) 생성 — 임시 비밀번호 출력
npm run db:seed-demo            # (선택) 데모 대결·팀·선수
npm run dev                     # http://localhost:3000 , 관리자: /login
```

> PGlite 는 한 프로세스만 DB 폴더를 열 수 있습니다. `db:*` 스크립트는 개발 서버를 끈 상태에서 실행하세요.

## 테스트

```bash
# 별도 DB로 서버 실행 후 E2E 시나리오(18개) 실행
DATABASE_URL=pglite:./.pglite-test npm run db:migrate && DATABASE_URL=pglite:./.pglite-test npm run db:init-admin
DATABASE_URL=pglite:./.pglite-test SEED_ANCHORS="난워니:nanwony@rwn.local,김옥독:kimokdok@rwn.local" npm run db:seed-anchors
DATABASE_URL=pglite:./.pglite-test npm run db:seed-demo
npm run build && DATABASE_URL=pglite:./.pglite-test npx next start -p 3100
E2E_BASE=http://localhost:3100 npm run test:e2e
```

## Vercel 배포

1. Neon 프로젝트 생성 → **Pooled connection string** 복사.
2. Vercel 프로젝트 환경변수: `DATABASE_URL`, `AUTH_SECRET`(32자+), `NEXT_PUBLIC_SITE_URL`(https://도메인).
3. 로컬에서 운영 DB로 마이그레이션·초기화 (한 번):
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate -- --dry-run   # 적용 목록 확인
   DATABASE_URL="postgresql://..." npm run db:migrate
   DATABASE_URL="postgresql://..." ADMIN_INITIAL_EMAIL=... ADMIN_INITIAL_PASSWORD=... npm run db:init-admin
   DATABASE_URL="postgresql://..." SEED_ANCHORS="난워니:...,김옥독:..." npm run db:seed-anchors
   ```
   `db:migrate` 는 DROP/TRUNCATE/DELETE/타입 변경이 포함된 마이그레이션을 **기본 거부**합니다. 백업·승인 후 `--allow-destructive` 로만 실행하세요.
4. Git 저장소를 Vercel 에 연결해 배포 (빌드 명령 `npm run build` 기본값).

## OBS 브라우저 소스 등록

| 소스 | URL | 권장 |
| --- | --- | --- |
| 속보 배너 | `https://도메인/overlay/breaking` | 1920×1080 |
| 하단 티커 | `/overlay/ticker` | 1920×1080 |
| 헤드라인 | `/overlay/headline` | 1920×1080 |
| 진행자 하단 자막 | `/overlay/lower-third` | 1920×1080 |
| 전쟁 현황판 | `/overlay/war-status` | 1920×1080 |
| 대기 화면 | `/overlay/standby` | 1920×1080 (전체 화면형) |

OBS → 소스 추가 → **브라우저** → URL 입력, 너비 1920 / 높이 1080, "사용자 지정 CSS"는 비워 두기(배경은 이미 투명).
"OBS에서 보이지 않을 때 소스 종료"는 끄는 것을 권장합니다. 송출 내용은 관리자 `/admin/overlays` 에서 자동/수동/끄기로 제어하며 약 4초 안에 반영됩니다.
브라우저에서 미리 볼 때는 `?bg=1` 을 붙이면 체크무늬 배경이 보입니다.

## 권한

| 역할 | 할 수 있는 일 |
| --- | --- |
| SUPER_ADMIN | 전체 + 계정·권한 관리, 감사 로그 열람 |
| EDITOR | 제보 검토, 사건·기사·속보·클립·팀·큐시트 |
| OPERATOR | 속보 송출, OBS, 큐시트·방송 진행, 사이트 설정 |
| ANCHOR | 본인 대본 작성, 큐 진행, 프롬프터 |

한 계정에 여러 역할을 줄 수 있습니다. 모든 관리자 API는 서버에서 세션·권한·Origin·CSRF 를 검사하고 감사 로그를 남깁니다.
