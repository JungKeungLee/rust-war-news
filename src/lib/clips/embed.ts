/**
 * 클립 임베드 정책
 *  - YouTube: 공식 iframe 임베드(youtube-nocookie) 자동 생성. 업로더가 임베드를 막은 영상은 플레이어 안에서 안내가 뜨므로
 *             항상 원본 링크도 함께 노출한다.
 *  - Twitch 클립: 공식 형식 clips.twitch.tv/embed?clip=ID&parent=도메인 자동 생성.
 *  - SOOP / 치지직: 공개 임베드 URL 형식이 문서로 확인되지 않아 기본은 외부 링크.
 *             관리자가 해당 플랫폼 공유 메뉴에서 받은 임베드 주소를 직접 입력하면(허용 도메인만) 임베드한다.
 *  - 그 외: 외부 링크만.
 */
export type ClipPlatform = "YOUTUBE" | "SOOP" | "CHZZK" | "TWITCH" | "OTHER";

export const EMBED_ALLOWED_HOSTS = [
  "www.youtube-nocookie.com",
  "www.youtube.com",
  "chzzk.naver.com",
  "vod.sooplive.co.kr",
  "play.sooplive.co.kr",
  "clips.twitch.tv",
  "player.twitch.tv",
];

export function detectPlatform(url: string): ClipPlatform {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "OTHER";
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YOUTUBE";
  if (host.endsWith("sooplive.co.kr") || host.endsWith("afreecatv.com")) return "SOOP";
  if (host.endsWith("chzzk.naver.com")) return "CHZZK";
  if (host.endsWith("twitch.tv")) return "TWITCH";
  return "OTHER";
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      if (m) id = m[2];
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function twitchClipId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "clips.twitch.tv") id = u.pathname.slice(1).split("/")[0];
    else {
      const m = u.pathname.match(/\/clip\/([^/?#]+)/);
      if (m) id = m[1];
    }
    return id && /^[A-Za-z0-9_-]{4,120}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** 원본 URL로부터 자동 임베드 정보 생성 */
export function buildEmbed(url: string, siteHost: string): { platform: ClipPlatform; embedUrl: string | null; thumbnailUrl: string | null } {
  const platform = detectPlatform(url);
  if (platform === "YOUTUBE") {
    const id = youtubeId(url);
    return {
      platform,
      embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}` : null,
      thumbnailUrl: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null,
    };
  }
  if (platform === "TWITCH") {
    const id = twitchClipId(url);
    return {
      platform,
      embedUrl: id ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&parent=${encodeURIComponent(siteHost)}` : null,
      thumbnailUrl: null,
    };
  }
  return { platform, embedUrl: null, thumbnailUrl: null };
}

/** 관리자가 수동 입력한 임베드 URL 검증: https + 허용 도메인만 */
export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && EMBED_ALLOWED_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function siteHostFromEnv(fallback = "localhost"): string {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname : fallback;
  } catch {
    return fallback;
  }
}
