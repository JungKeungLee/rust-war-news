import { Suspense } from "react";
import { TickerOverlay } from "@/components/overlay/Overlays";

export const metadata = { title: "OBS · 티커" };

export default function Page() {
  return (
    <Suspense>
      <TickerOverlay />
    </Suspense>
  );
}
