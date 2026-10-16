import { Suspense } from "react";
import { HeadlineOverlay } from "@/components/overlay/Overlays";

export const metadata = { title: "OBS · 헤드라인" };

export default function Page() {
  return (
    <Suspense>
      <HeadlineOverlay />
    </Suspense>
  );
}
