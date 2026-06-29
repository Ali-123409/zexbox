/**
 * HindiDubAnime source — wraps our /api/hda proxy
 *
 * hindidubanime.com does NOT send CORS headers, so the browser can't call
 * its WP REST API directly. We route through our own server-side proxy.
 *
 * Verified endpoints (2026-06-29):
 *   Search: GET /api/hda?action=search&keyword={kw}&page=0
 *   Browse: GET /api/hda?action=browse&page=0
 *
 * Stream discovery:
 *   Episode stream URLs are extracted by the /api/hindidub proxy, which
 *   fetches the episode HTML page and parses out the iframe src.
 */

import type { SourceClient, UnifiedItem } from "./types";

export const hindidubanime: SourceClient = {
  id: "hindidubanime",
  name: "HindiDubAnime",
  browsable: true,

  async browse(page = 1) {
    try {
      const url = `/api/hda?action=browse&page=${page - 1}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const raw = await res.json();
      return (raw?.items || []) as UnifiedItem[];
    } catch {
      return [];
    }
  },

  async search(keyword, page = 0) {
    if (!keyword.trim()) return [];
    try {
      const url = `/api/hda?action=search&keyword=${encodeURIComponent(keyword)}&page=${page}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const raw = await res.json();
      return (raw?.items || []) as UnifiedItem[];
    } catch {
      return [];
    }
  },

  async resolve(item, _season, episode) {
    // Construct episode URL from the anime slug
    const slug = item.movieboxSubjectId;
    const epNum = Number(episode) || 1;
    const episodes: { num: number; title: string; link: string }[] = [];

    // Build a stub episode list (guess 12 episodes — typical cour length)
    const guessedCount = 12;
    for (let i = 1; i <= guessedCount; i++) {
      episodes.push({
        num: i,
        title: `Episode ${i}`,
        link: `https://hindidubanime.com/watch/${slug}-episode-${i}/`,
      });
    }

    // Fetch the actual stream via our proxy
    const targetLink = `https://hindidubanime.com/watch/${slug}-episode-${epNum}/`;
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
      // Fall through
    }

    return { episodes };
  },
};
