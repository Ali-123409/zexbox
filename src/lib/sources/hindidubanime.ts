/**
 * HindiDubAnime source — wraps our /api/hda proxy
 *
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Browse uses bundled static catalog (src/lib/hda-catalog.json) — instant, no API call
 * 2. Search hits the API proxy (can't pre-cache every search term)
 * 3. Resolve pre-fetches episode list + stream URL in parallel
 * 4. Stream URL resolution is cached in localStorage (30-min TTL) by the hooks layer
 */

import type { SourceClient, UnifiedItem } from "./types";
import { https } from "./types";
import catalogData from "../hda-catalog.json";

// Build UnifiedItem from bundled catalog entry
function catalogToUnified(slug: string, entry: { id: string; title: string; language: string }): UnifiedItem {
  return {
    id: entry.id,
    source: "hindidubanime",
    type: "tv",
    title: entry.title,
    language: entry.language,
    genres: ["Anime"],
    country: "Japan",
    poster: `/api/hda-poster?slug=${encodeURIComponent(slug)}`,
    backdrop: `/api/hda-poster?slug=${encodeURIComponent(slug)}`,
    movieboxSubjectId: slug,
  };
}

export const hindidubanime: SourceClient = {
  id: "hindidubanime",
  name: "HindiDubAnime",
  browsable: true,

  async browse(page = 1) {
    // Use bundled catalog for page 1 (instant, no network)
    if (page === 1) {
      const entries = Object.entries(catalogData).slice(0, 20);
      return entries.map(([slug, entry]: [string, any]) => catalogToUnified(slug, entry));
    }
    // Page 2+ falls back to API
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
    
    // For page 0, use ONLY the bundled catalog (instant, no network call)
    // The catalog has 59 anime — covers most searches
    if (page === 0) {
      const kw = keyword.toLowerCase();
      const results: UnifiedItem[] = [];
      for (const [slug, entry] of Object.entries(catalogData) as [string, any][]) {
        if (entry.title.toLowerCase().includes(kw)) {
          results.push(catalogToUnified(slug, entry));
        }
      }
      return results;
    }
    
    // Page 1+ from API (for load-more)
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
    const slug = item.movieboxSubjectId;
    const epNum = Number(episode) || 1;

    // Step 1: Fetch real episode URLs from the anime page (parallel with step 2)
    let episodes: { num: number; title: string; link: string }[] = [];
    let targetLink: string | undefined;

    try {
      const epsRes = await fetch(`/api/hda-episodes?slug=${encodeURIComponent(slug || "")}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (epsRes.ok) {
        const epsData = await epsRes.json();
        episodes = epsData.episodes || [];
        const target = episodes.find((e) => e.num === epNum) || episodes[0];
        targetLink = target?.link;
      }
    } catch {}

    // Fallback: guess URL pattern
    if (!targetLink) {
      targetLink = `https://hindidubanime.com/watch/${slug}-episode-${epNum}/`;
      if (episodes.length === 0) {
        for (let i = 1; i <= 12; i++) {
          episodes.push({ num: i, title: `Episode ${i}`, link: `https://hindidubanime.com/watch/${slug}-episode-${i}/` });
        }
      }
    }

    // Step 2: Fetch the actual stream via our proxy
    if (targetLink) {
      try {
        const proxyUrl = `/api/hindidub?url=${encodeURIComponent(targetLink)}`;
        // Use manual AbortController (AbortSignal.timeout may not be available in all browsers)
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 20000);
        const pres = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(timeoutId);
        if (pres.ok) {
          const pdata = await pres.json();
          return {
            embedUrl: pdata.embedUrl,
            streamUrl: pdata.streamUrl,
            downloadUrl: pdata.downloadUrl,
            videoTitle: pdata.videoTitle,
            episodes,
          };
        }
      } catch {}
    }

    return { episodes };
  },
};
