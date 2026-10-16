/** /api/admin/episodes/[id] 응답 (JSON 직렬화 형태) */
export type ScriptJson = { id: string; rundownItemId: string; anchorId: string; body: string; version: number; updatedAt: string };

export type RundownItemJson = {
  id: string;
  episodeId: string;
  position: number;
  kind: "ARTICLE" | "CLIP" | "BREAKING" | "SEGMENT";
  title: string;
  articleId: string | null;
  clipId: string | null;
  breakingId: string | null;
  anchorId: string | null;
  plannedSeconds: number;
  status: "PENDING" | "ON_AIR" | "DONE" | "SKIPPED";
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  version: number;
  articleTitle: string | null;
  articleStatus: string | null;
  clipTitle: string | null;
  clipUrl: string | null;
  clipEmbedUrl: string | null;
  anchorName: string | null;
  anchorColor: string | null;
  scripts: ScriptJson[];
};

export type EpisodeJson = {
  id: string;
  eventId: string | null;
  number: number | null;
  title: string;
  scheduledAt: string | null;
  status: "PLANNED" | "READY" | "LIVE" | "ENDED";
  startedAt: string | null;
  endedAt: string | null;
  liveUrl: string | null;
  replayUrl: string | null;
  isPublic: boolean;
  currentItemId: string | null;
  version: number;
};

export type EpisodeFullJson = {
  episode: EpisodeJson;
  anchors: { id: string; displayName: string; color: string | null }[];
  items: RundownItemJson[];
  serverTime?: string;
};
