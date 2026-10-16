export const ROLE_CODES = ["SUPER_ADMIN", "EDITOR", "ANCHOR", "OPERATOR"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: "최고 관리자",
  EDITOR: "편집자",
  ANCHOR: "진행자",
  OPERATOR: "방송 운영자",
};

/** 권한 → 허용 역할. SUPER_ADMIN 은 모든 권한을 가진다. */
const MATRIX = {
  "admin.access": ["EDITOR", "ANCHOR", "OPERATOR"],
  // 뉴스 진행자(ANCHOR)는 제보·사건·기사·속보·큐시트·팀 상태 업무 수행 (계정·사이트·방송 설정은 불가)
  "reports.review": ["EDITOR", "ANCHOR"],
  "incidents.manage": ["EDITOR", "ANCHOR"],
  "articles.manage": ["EDITOR", "ANCHOR"],
  "breaking.manage": ["EDITOR", "OPERATOR", "ANCHOR"],
  "clips.manage": ["EDITOR"],
  "teams.manage": ["EDITOR"],
  "teamstatus.manage": ["EDITOR", "OPERATOR", "ANCHOR"],
  "episodes.manage": ["EDITOR", "OPERATOR", "ANCHOR"],
  // 메인 방송 URL·상태: 최고 관리자 + 방송 운영자(OPERATOR 역할을 명시적으로 받은 계정)
  "broadcast.manage": ["OPERATOR"],
  "rundown.script": ["EDITOR", "ANCHOR", "OPERATOR"],
  "rundown.operate": ["EDITOR", "ANCHOR", "OPERATOR"],
  "overlays.manage": ["EDITOR", "OPERATOR"],
  "polls.manage": ["EDITOR", "OPERATOR"],
  "flags.manage": ["EDITOR"],
  "settings.manage": ["OPERATOR"],
  "users.manage": [],
  "audit.view": [],
} as const satisfies Record<string, readonly RoleCode[]>;

export type Permission = keyof typeof MATRIX;

export function hasPermission(roles: readonly string[], perm: Permission): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  return (MATRIX[perm] as readonly string[]).some((r) => roles.includes(r));
}
