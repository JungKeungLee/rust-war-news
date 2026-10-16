"use client";

import { ErrorScreen, type ErrorBoundaryProps } from "@/components/ErrorScreen";

/** 루트 오류 경계: (site)·admin 레이아웃 자체의 데이터 조회 실패까지 잡는다. */
export default function RootError(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}
