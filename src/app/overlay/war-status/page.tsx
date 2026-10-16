import { Suspense } from "react";
import { WarStatusOverlay } from "@/components/overlay/Overlays";

export const metadata = { title: "OBS · 전쟁 현황" };

export default function Page() {
  return (
    <Suspense>
      <WarStatusOverlay />
    </Suspense>
  );
}
