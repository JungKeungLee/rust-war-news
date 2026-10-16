import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RUST WAR NEWS", template: "%s | RWN" },
  description: "Rust 대결 팬 뉴스 방송국 RWN — 실시간 속보, 정규 뉴스, 제보, 핫 클립. 게임 개발사의 공식 사이트가 아닙니다.",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
