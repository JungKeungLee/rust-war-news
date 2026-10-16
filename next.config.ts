import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 외부 영상 임베드 허용 도메인 (클립 임베드 정책과 동일하게 유지)
const frameSrc = [
  "'self'",
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://chzzk.naver.com",
  "https://vod.sooplive.co.kr",
  "https://play.sooplive.co.kr",
  "https://clips.twitch.tv",
  "https://player.twitch.tv",
].join(" ");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  `frame-src ${frameSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // 일반 페이지: 외부 사이트 iframe 삽입 금지
        source: "/((?!overlay/).*)",
        headers: [
          { key: "Content-Security-Policy", value: `${csp}; frame-ancestors 'none'` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // OBS 오버레이: 관리자 미리보기를 위해 같은 출처 iframe 만 허용 (OBS 브라우저 소스는 직접 로드)
        source: "/overlay/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `${csp}; frame-ancestors 'self'` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
