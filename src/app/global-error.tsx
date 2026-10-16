"use client";

import "./globals.css";
import { ErrorScreen, type ErrorBoundaryProps } from "@/components/ErrorScreen";

/** 루트 레이아웃까지 실패한 경우의 최후 오류 화면 (html/body 를 직접 렌더) */
export default function GlobalError(props: ErrorBoundaryProps) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">
        <ErrorScreen {...props} />
      </body>
    </html>
  );
}
