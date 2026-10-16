"use client";

import { ErrorScreen, type ErrorBoundaryProps } from "@/components/ErrorScreen";

export default function SiteError(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />;
}
