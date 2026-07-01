/**
 * AnimeVilla source — wraps our /api/animevilla proxy.
 *
 * AnimeVilla (animevilla.org) is a Hindi-dubbed anime site with 294 anime,
 * using the same Kiranime Pro theme as HindiDubAnime. Unlike HDA, animevilla
 * does NOT have an embedded streaming player in the page — it only offers
 * batch download links via hsalinks.in. So we use the MovieBox fallback path
 * for playback (search MovieBox for the cleaned title and play their MP4 stream).
 *
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Browse uses bundled static catalog (src/lib/animevilla-catalog.json, 294 items, 42KB)
 *    — instant, no API call
 * 2. Search hits the bundled catalog first, then API for load-more
 * 3. Resolve falls back to MovieBox for ad-free MP4 playback
 * 4. Download links are extracted from the anime page (hsalinks.in batch URLs)
 */

import type { SourceClient, UnifiedItem } from "./types";
import { https } from "./types";
import catalogData from "../animevilla-catalog.json";

// Build UnifiedItem from bundled catalog entry
function catalogToUnified(
  slug: string,
  entry: { id: string; title: string; language: string; year?: string; ep?: number; p?: string; g?: string[] }
): UnifiedItem {
  return {
    id: entry.id,
    source: "animevilla",
    type: "tv",
    title: entry.title,
    year: entry.year,
    language: entry.language,
    genres: entry.g?.length ? entry.g : ["Anime"],
    country: "Japan",
    poster: entry.p,
    backdrop: entry.p,
    movieboxSubjectId: slug,
    episodeCount: entry.ep,
  };
}

export const animevilla: SourceClient = {
  id: "animevilla",
  name: "AnimeVilla",
  browsable: true,

  async browse(page = 1) {
    // Page 1: first 20 from bundled catalog (instant)
    if (page === 1) {
      const entries = Object.entries(catalogData).slice(0, 20);
      return entries.map(([slug, entry]: [string, any]) => catalogToUnified(slug, entry));
    }
    // Page 2+ from API
    try {
      const url = `/api/animevilla?action=browse&page=${page - 1}`;
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

    // Page 0: use bundled catalog (instant)
    if (page === 0) {
      const kw = keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
      const results: UnifiedItem[] = [];
      for (const [slug, entry] of Object.entries(catalogData) as [string, any][]) {
        const normalizedTitle = entry.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normalizedTitle.includes(kw)) {
          results.push(catalogToUnified(slug, entry));
        }
      }
      return results;
    }

    // Page 1+ from API
    try {
      const url = `/api/animevilla?action=search&keyword=${encodeURIComponent(keyword)}&page=${page}`;
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

    // Step 1: Fetch episode list + download links from anime page (parallel with step 2)
    let episodes: { num: number; title: string; link: string }[] = [];
    let downloadLinks: { quality: string; range: string; url: string }[] = [];
    let animeLink: string | undefined;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(
        `/api/animevilla?action=episodes&slug=${encodeURIComponent(slug || "")}`,
        { signal: ctrl.signal }
      );
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        episodes = data.episodes || [];
        downloadLinks = data.downloadLinks || [];
        animeLink = data.link;
      }
    } catch {}

    // If no episodes found, synthesize a numbered list
    if (episodes.length === 0 && item.episodeCount) {
      for (let i = 1; i <= Math.min(item.episodeCount, 24); i++) {
        episodes.push({
          num: i,
          title: `Episode ${i}`,
          link: `https://animevilla.org/anime/${slug}/`,
        });
      }
    }

    // Step 2: Try MovieBox fallback for ad-free MP4 playback
    // Search MovieBox for the cleaned title, then play
    try {
      const searchUrl = `/api/moviebox?action=search&keyword=${encodeURIComponent(item.title)}&size=5`;
      const searchRes = await fetch(searchUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const mbItems = searchData.items || [];

        // Find best match — prefer TV shows with similar title
        const kw = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        let bestMatch: any = null;
        let bestScore = 0;
        for (const mb of mbItems) {
          const mbTitle = (mb.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!mbTitle) continue;
          // Score: longest common prefix
          let score = 0;
          for (let i = 0; i < Math.min(kw.length, mbTitle.length); i++) {
            if (kw[i] === mbTitle[i]) score++;
            else break;
          }
          // Bonus for exact match
          if (mbTitle === kw) score += 100;
          // Bonus for being a TV show (animevilla is all TV)
          if (mb.type === "tv") score += 10;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = mb;
          }
        }

        // Use match if it shares at least 4 chars of prefix with the title
        if (bestMatch && bestScore >= 4) {
          const mbSubjectId = String(bestMatch.id);
          const playUrl = `/api/moviebox?action=play&subjectId=${mbSubjectId}&se=1&ep=${epNum}`;
          const playRes = await fetch(playUrl, {
            signal: AbortSignal.timeout(15000),
          });
          if (playRes.ok) {
            const playData = await playRes.json();
            const mbStreams = (playData.streams || [])
              .map((s: any) => ({
                quality: String(s.resolutions || s.resolution || s.quality || "?"),
                url: s.url || s.playUrl || "",
                size: s.size ? Number(s.size) : undefined,
              }))
              .filter((s: any) => s.url)
              .sort((a: any, b: any) => Number(a.quality) - Number(b.quality));

            if (mbStreams.length > 0) {
              const mp4 = mbStreams.find((s: any) => s.url.endsWith(".mp4"));
              const streamUrl = mp4?.url || mbStreams[0].url;
              return {
                streamUrl,
                streams: mbStreams,
                downloadLinks, // Keep animevilla batch download links too
                episodes,
                animeLink,
                mbMatchTitle: bestMatch.title,
              };
            }
          }
        }
      }
    } catch {}

    // Step 3: No MB match — return episodes + download links only
    // Player will show "Open on AnimeVilla" button as fallback
    return {
      episodes,
      downloadLinks,
      animeLink: animeLink || `https://animevilla.org/anime/${slug}/`,
    };
  },
};
