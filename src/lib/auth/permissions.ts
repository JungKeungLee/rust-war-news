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
  "reports.review": ["EDITOR"],
  "incidents.manage": ["EDITOR"],
  "articles.manage": ["EDITOR"],
  "breaking.manage": ["EDITOR", "OPERATOR"],
  "clips.manage": ["EDITOR"],
  "teams.manage": ["EDITOR"],
  "episodes.manage": ["EDITOR", "OPERATOR"],
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
