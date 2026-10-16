import { Suspense } from "react";
import { StandbyOverlay } from "@/components/overlay/Overlays";

export const metadata = { title: "OBS · 대기 화면" };

export default function Page() {
  return (
    <Suspense>
      <StandbyOverlay />
    </Suspense>
  );
}
