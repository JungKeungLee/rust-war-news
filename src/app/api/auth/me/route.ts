import { adminRoute } from "@/lib/api/handler";

/** 현재 로그인 사용자와 CSRF 토큰 */
export const GET = adminRoute(
  "admin.access",
  async ({ session }) => ({
    user: { id: session.userId, email: session.email, displayName: session.displayName, roles: session.roles, mustChangePassword: session.mustChangePassword },
    csrfToken: session.csrfToken,
  }),
  { allowWhilePasswordChangeRequired: true },
);
