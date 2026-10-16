import { publicRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { OVERLAY_KEYS, type OverlayKey } from "@/lib/labels";
import { resolveOverlay } from "@/server/live";
import type { OverlayResponse } from "@/lib/live/types";

export const dynamic = "force-dynamic";

/** OBS 오버레이 상태. 공개 가능한 정보만 포함한다. */
export const GET = publicRoute<{ key: string }>(async ({ db, params }) => {
  if (!OVERLAY_KEYS.includes(params.key as OverlayKey)) throw notFound("오버레이");
  const { state, version } = await resolveOverlay(db, params.key as OverlayKey);
  return { serverTime: new Date().toISOString(), version, state } satisfies OverlayResponse;
});
