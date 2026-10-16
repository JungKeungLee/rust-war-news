import { Suspense } from "react";
import { LowerThirdOverlay } from "@/components/overlay/Overlays";

export const metadata = { title: "OBS · 하단 자막" };

export default function Page() {
  return (
    <Suspense>
      <LowerThirdOverlay />
    </Suspense>
  );
}
