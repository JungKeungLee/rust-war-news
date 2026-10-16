import { youtubeId } from "@/lib/clips/embed";
import type { BroadcastStatus } from "@/lib/labels";

/**
 * 메인 방송 플레이어 임베드 정책
 *
 *  - SOOP: 방송 페이지의 '퍼가기' 기능이 제공하는 플레이어 주소 play.sooplive.com/{아이디}/embed 사용.
 *          (해당 주소는 X-Frame-Options·frame-ancestors 제한이 없어 외부 iframe 이 허용됨을 응답 헤더로 확인.
 *           공식 개발자 문서로는 확인하지 못했으므로, 재생이 막히면 항상 원본 링크로 시청할 수 있게 한다.)
 *          자동 재생은 브라우저 정책상 음소거 상태(mutePlay=true)로만 시작한다.
 *  - YouTube: 공식 iframe 임베드(youtube-nocookie). 업로더가 임베드를 막으면 플레이어 안에 안내가 뜬다.
 *  - Twitch: 공식 임베드 player.twitch.tv/?channel=…&parent=도메인.
 *  - 치지직·기타: 공개 임베드 형식을 확인하지 못해 썸네일 + 원본 링크로만 표시.
 *
 * 방송 상태(LIVE 등)는 외부 플랫폼에서 자동 감지하지 않는다. 관리자가 수동으로 설정한 값이다.
 */
export type BroadcastPlatform = "SOOP" | "YOUTUBE" | "TWITCH" | "CHZZK" | "OTHER";

export const BROADCAST_PLATFORM_LABEL: Record<BroadcastPlatform, string> = {
  SOOP: "SOOP",
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  CHZZK: "치지직",
  OTHER: "외부 방송",
};

/** SOOP 방송 주소에서 방송국 아이디 추출 (play./ch./www.sooplive.co.kr/station/, 구 afreecatv 주소 포함) */
export function soopId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  if (/^(play|ch|bj)\.(sooplive\.(co\.kr|com)|afreecatv\.com)$/.test(host)) id = parts[0];
  else if (/^(www\.)?(sooplive\.(co\.kr|com)|afreecatv\.com)$/.test(host) && parts[0] === "station") id = parts[1];
  return id && /^[a-z0-9_]{2,40}$/i.test(id) && id !== "embed" ? id.toLowerCase() : null;
}

function twitchChannel(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)twitch\.tv$/.test(u.hostname)) return null;
    const ch = u.pathname.split("/").filter(Boolean)[0];
    return ch && /^[a-z0-9_]{3,25}$/i.test(ch) && !["videos", "directory", "clip"].includes(ch) ? ch.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function detectBroadcastPlatform(url: string): BroadcastPlatform {
  if (soopId(url)) return "SOOP";
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === "youtu.be" || h.endsWith("youtube.com")) return "YOUTUBE";
    if (h.endsWith("twitch.tv")) return "TWITCH";
    if (h.endsWith("chzzk.naver.com")) return "CHZZK";
  } catch {
    /* ignore */
  }
  return "OTHER";
}

/** 공식/플랫폼 제공 방식으로 만들 수 있는 임베드 주소. 만들 수 없으면 null (원본 링크로 표시) */
export function buildBroadcastEmbed(url: string, siteHost: string): { platform: BroadcastPlatform; embedUrl: string | null } {
  const platform = detectBroadcastPlatform(url);
  if (platform === "SOOP") {
    const id = soopId(url)!;
    return { platform, embedUrl: `https://play.sooplive.com/${encodeURIComponent(id)}/embed?autoPlay=true&mutePlay=true` };
  }
  if (platform === "YOUTUBE") {
    const id = youtubeId(url);
    return { platform, embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1` : null };
  }
  if (platform === "TWITCH") {
    const ch = twitchChannel(url);
    return { platform, embedUrl: ch ? `https://player.twitch.tv/?channel=${ch}&parent=${encodeURIComponent(siteHost)}&muted=true` : null };
  }
  return { platform, embedUrl: null };
}

export type BroadcastSetting = {
  url: string | null;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  /** 관리자가 수동으로 지정하는 상태 (자동 감지 아님) */
  status: BroadcastStatus;
  offlineMessage: string | null;
  isPublic: boolean;
};

export const DEFAULT_BROADCAST: BroadcastSetting = {
  url: null,
  title: null,
  description: null,
  thumbnailUrl: null,
  status: "STANDBY",
  offlineMessage: null,
  isPublic: true,
};

export const DEFAULT_OFFLINE_MESSAGE = "현재 뉴스 방송을 준비 중입니다. 최신 속보와 팀별 지통실을 확인해주세요.";

/** 공개 화면용 방송 정보 (비공개면 URL 등은 내보내지 않음) */
export type PublicBroadcast = {
  status: BroadcastStatus;
  statusSource: "MANUAL";
  title: string | null;
  description: string | null;
  platform: BroadcastPlatform | null;
  url: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  offlineMessage: string;
  updatedAt: string | null;
};

export function toPublicBroadcast(b: BroadcastSetting, updatedAt: Date | null, siteHost: string): PublicBroadcast {
  if (!b.isPublic || !b.url) {
    return {
      status: b.isPublic ? (b.status === "LIVE" ? "UNKNOWN" : b.status) : "OFFLINE",
      statusSource: "MANUAL",
      title: b.isPublic ? b.title : null,
      description: b.isPublic ? b.description : null,
      platform: null,
      url: null,
      embedUrl: null,
      thumbnailUrl: b.isPublic ? b.thumbnailUrl : null,
      offlineMessage: b.offlineMessage || DEFAULT_OFFLINE_MESSAGE,
      updatedAt: updatedAt?.toISOString() ?? null,
    };
  }
  const { platform, embedUrl } = buildBroadcastEmbed(b.url, siteHost);
  return {
    status: b.status,
    statusSource: "MANUAL",
    title: b.title,
    description: b.description,
    platform,
    url: b.url,
    embedUrl,
    thumbnailUrl: b.thumbnailUrl,
    offlineMessage: b.offlineMessage || DEFAULT_OFFLINE_MESSAGE,
    updatedAt: updatedAt?.toISOString() ?? null,
  };
}
