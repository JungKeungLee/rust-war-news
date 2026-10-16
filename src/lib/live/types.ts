/** 실시간 상태 계약. 전송 방식(폴링/외부 메시징)과 무관하게 이 형태를 유지한다. */

export type LiveBreaking = {
  id: string;
  title: string;
  body: string | null;
  priority: "URGENT" | "NORMAL";
  verificationStatus: string;
  isPinned: boolean;
  showOnOverlay: boolean;
  startsAt: string | null;
  correctedAt: string | null;
  correctionNote: string | null;
  incidentId: string | null;
};

export type PublicLiveState = {
  serverTime: string;
  /** 메인 방송 (상태는 관리자 수동 설정, statusSource = MANUAL) */
  broadcast: import("@/lib/broadcast").PublicBroadcast;
  live: { isLive: boolean; url: string | null; title: string | null };
  notice: string | null;
  breaking: LiveBreaking[];
};

export type OverlayState =
  | { key: "breaking"; visible: boolean; item: LiveBreaking | null }
  | { key: "ticker"; visible: boolean; items: { label: string; text: string; urgent?: boolean }[] }
  | { key: "headline"; visible: boolean; label: string; title: string; subtitle: string | null }
  | { key: "lower_third"; visible: boolean; name: string; role: string; color: string | null }
  | {
      key: "war_status";
      visible: boolean;
      title: string;
      teams: { id: string; name: string; shortName: string | null; color: string; score: number; statusLabel: string | null; isEliminated: boolean }[];
    }
  | { key: "standby"; visible: boolean; title: string; message: string | null; startsAt: string | null };

export type OverlayResponse = { serverTime: string; version: string; state: OverlayState };
