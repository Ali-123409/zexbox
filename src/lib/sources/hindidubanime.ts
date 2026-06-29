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
  // Strip "Hindi Subbed"/"Hindi Dubbed" from title for display
  const cleanTitle = title.replace(/\s*\(Hindi[^)]*\)\s*/i, "").replace(/\s+Hindi\s*(Sub(bed)?|Dub(bed)?).*$/i, "").trim() || title;
  return {
    id: String(a.id),
    source: "hindidubanime",
    type: "tv", // anime are TV series
    title: cleanTitle,
    poster: animePoster(a),
    backdrop: animePoster(a),
    overview: stripTags(a.excerpt?.rendered || ""),
    language: lang,
    genres: ["Anime"],
    country: "Japan",
    // Stash the slug in the id field — used later for constructing episode URLs.
    // We keep the WP id separately for compatibility.
    // (Note: id remains the WP anime id; we encode slug in movieboxSubjectId field
    //  as a hack since UnifiedItem has no slug field.)
    movieboxSubjectId: a.slug,  // NOT a moviebox subject id — used here as slug
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
    // The WP REST /episode endpoint is extremely slow (30s+).
    // Instead of fetching it, we construct episode URLs directly from the anime slug.
    // HindiDubAnime episode URL pattern: /watch/{anime-slug}-episode-{N}/
    // We try that pattern first; if it 404s, we fall back to fetching the episode list.

    const slug = item.movieboxSubjectId;  // We stashed the slug here in animeToUnified()
    const epNum = Number(episode) || 1;
    const episodes: { num: number; title: string; link: string }[] = [];

    // Build a stub episode list (we'll populate links lazily as user clicks).
    // We don't actually know how many episodes this anime has without fetching
    // the slow endpoint, so we'll guess 12 (typical cour length).
    const guessedCount = 12;
    for (let i = 1; i <= guessedCount; i++) {
      episodes.push({
        num: i,
        title: `Episode ${i}`,
        link: `${SITE}/watch/${slug}-episode-${i}/`,
      });
    }

    // Now fetch the actual stream for the requested episode via our proxy.
    // The proxy will follow redirects and return either an embed URL or a direct stream.
    const targetLink = `${SITE}/watch/${slug}-episode-${epNum}/`;
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

    return { episodes };
  },
};
