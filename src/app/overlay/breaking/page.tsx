import { Suspense } from "react";
import { BreakingOverlay } from "@/components/overlay/Overlays";

export const metadata = { title: "OBS · 속보" };

export default function Page() {
  return (
    <Suspense>
      <BreakingOverlay />
    </Suspense>
  );
}
