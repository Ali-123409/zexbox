/**
 * HindiDubAnime source — WordPress REST API
 *
 * Verified endpoints (2026-06-29):
 *   GET /wp-json/wp/v2/anime?per_page=20&_embed=1
 *     - Slow (~5-30s) but works. Returns anime series with poster, title, slug.
 *   GET /wp-json/wp/v2/episode?per_page=50&_embed=1
 *     - Fast. Returns episode list (id, title, slug, link, parent anime).
 *   GET /wp-json/wp/v2/anime?search={keyword}
 *     - Returns matching anime.
 *
 * Stream discovery:
 *   Episode REST content is empty. We must fetch the episode HTML page
 *   to find iframe src (e.g. abyssplayer.com/{id}) which then resolves
 *   to a Google Storage MP4: storage.googleapis.com/mediastorage/{ts}/{hash}/{id}.mp4
 *
 *   For browser playback, we proxy through /api/hindidub?url={episode_link}
 *   to extract the iframe src server-side (CORS-blocked otherwise).
 */

import type { SourceClient, UnifiedItem } from "./types";
import { https } from "./types";

const SITE = "https://hindidubanime.com";
const WP = `${SITE}/wp-json/wp/v2`;

interface WPAnime {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  featured_media?: number;
  _embedded?: any;
  // Custom kiranime fields
  meta?: any;
}

interface WPEpisode {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  episode_type?: string;
  // parent anime ID
  anime_parent?: number;
  _embedded?: any;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "—");
}

function stripTags(s: string): string {
  return decodeHtml((s || "").replace(/<[^>]+>/g, "")).trim();
}

function animePoster(a: WPAnime): string | undefined {
  // _embedded['wp:featuredmedia'][0].source_url
  const fm = a._embedded?.["wp:featuredmedia"];
  if (Array.isArray(fm) && fm[0]) {
    return https(fm[0].source_url);
  }
  return undefined;
}

function animeToUnified(a: WPAnime): UnifiedItem | null {
  const title = stripTags(a.title?.rendered || "");
  if (!title) return null;
  // Detect "Hindi Subbed" / "Hindi Dubbed" from title
  const lang = /hindi\s*sub/i.test(title) ? "Hindi Sub" : /hindi\s* dub/i.test(title) ? "Hindi Dub" : "Hindi";
  return {
    id: String(a.id),
    source: "hindidubanime",
    type: "tv", // anime are TV series
    title: title.replace(/\s*\(Hindi.*\)/i, "").replace(/Hindi\s*(Sub|Dub).*$/i, "").trim() || title,
    poster: animePoster(a),
    backdrop: animePoster(a),
    overview: stripTags(a.excerpt?.rendered || ""),
    language: lang,
    genres: ["Anime"],
    country: "Japan",
    // Use slug for episode fetch
  };
}

export const hindidubanime: SourceClient = {
  id: "hindidubanime",
  name: "HindiDubAnime",
  browsable: true,

  async browse(page = 1) {
    try {
      const url = `${WP}/anime?per_page=30&page=${page}&_embed=1&_fields=id,slug,link,title,excerpt,featured_media,_embedded`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const items: WPAnime[] = await res.json();
      return items.map(animeToUnified).filter(Boolean) as UnifiedItem[];
    } catch {
      return [];
    }
  },

  async search(keyword, _page = 0) {
    if (!keyword.trim()) return [];
    try {
      const url = `${WP}/anime?search=${encodeURIComponent(keyword)}&per_page=20&_embed=1&_fields=id,slug,link,title,excerpt,featured_media,_embedded`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const items: WPAnime[] = await res.json();
      return items.map(animeToUnified).filter(Boolean) as UnifiedItem[];
    } catch {
      return [];
    }
  },

  async resolve(item, _season, episode) {
    // Try to get episode list. The /wp-json/wp/v2/episode endpoint is very slow
    // (often 30s+), so we use a short timeout and gracefully degrade.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let episodes: { num: number; title: string; link: string }[] = [];
    let targetLink: string | undefined;

    try {
      const epsUrl = `${WP}/episode?per_page=50&_fields=id,slug,link,title,episode_type,parent`;
      const res = await fetch(epsUrl, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const eps: WPEpisode[] = await res.json();
        const animeId = Number(item.id);
        const mine = eps
          .filter((e) => Number(e.anime_parent || (e as any).parent || 0) === animeId)
          .sort((a, b) => a.id - b.id);

        episodes = mine.map((e, i) => ({
          num: i + 1,
          title: stripTags(e.title?.rendered || `Episode ${i + 1}`),
          link: e.link,
        }));

        // Pick target episode
        const epNum = Number(episode) || 1;
        targetLink = mine[Math.min(epNum - 1, mine.length - 1)]?.link;
      }
    } catch {
      clearTimeout(timeout);
      // Episode list fetch failed — we can still try direct stream extraction
      // by constructing an episode URL from the anime slug + episode number.
      const epNum = Number(episode) || 1;
      const guessSlug = `episode-${epNum}`;
      targetLink = `${SITE}/watch/${guessSlug}/`;
    }

    // If we have a target episode link, try to extract the stream URL.
    // The proxy has a 12s timeout itself; if it fails, we still return episodes
    // so the UI can show the episode list (user can retry).
    if (targetLink) {
      try {
        const proxyUrl = `/api/hindidub?url=${encodeURIComponent(targetLink)}`;
        const pres = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        if (pres.ok) {
          const pdata = await pres.json();
          return {
            embedUrl: pdata.embedUrl,
            streamUrl: pdata.streamUrl,
            episodes,
          };
        }
      } catch {
        // Fall through — return episodes without stream
      }
    }

    return { episodes };
  },
};
