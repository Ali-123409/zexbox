/**
 * Unified multi-source resolver.
 *
 * The app does NOT expose a source picker. Instead, all searches fire in
 * parallel against every source, results are merged & deduped, and each
 * item remembers where it came from so the player knows how to play it.
 *
 * Resolve priority when playing an item:
 *   1. If item has `embedUrl` or `streamUrl` pre-set (fmovies direct), use it.
 *   2. If item has `movieboxSubjectId` (NetMirror), resolve via MovieBox play.
 *   3. Otherwise, resolve via the item's own source.
 *   4. If primary fails, fall back to Fmovies direct embed (needs imdb_id).
 */

import type { SourceClient, UnifiedItem } from "./types";
import { safeAll, dedupeItems } from "./types";
import { moviebox } from "./moviebox";
import { netmirror } from "./netmirror";
import { fmovies } from "./fmovies";
import { hindidubanime } from "./hindidubanime";
import { fetchHomeDirect } from "../h5api";

export const SOURCES: SourceClient[] = [moviebox, netmirror, fmovies, hindidubanime];

/**
 * Unified search — fires all sources in parallel, merges results.
 * Empty keyword returns home/trending from browsable sources.
 * Pass page > 0 to fetch additional results (Load More button).
 */
export async function unifiedSearch(keyword: string, page: number = 0): Promise<UnifiedItem[]> {
  const k = keyword.trim();

  if (!k) {
    // Home / trending — only browsable sources contribute
    const results = await Promise.all(
      SOURCES.filter((s) => s.browsable).map((s) => safeAll(s.browse!(0), 12000))
    );
    // Don't dedupe across home — different sources have different curation
    return results.flat();
  }

  // Parallel search across all sources (with pagination)
  const results = await Promise.all(
    SOURCES.map((s) => safeAll(s.search(k, page), 10000))
  );

  // Dedupe by title+year, keeping first seen (priority order: moviebox, netmirror, fmovies, hindidubanime)
  const merged = results.flat();
  return dedupeItems(merged);
}

type ResolveResult = {
  streamUrl?: string;
  embedUrl?: string;
  streams?: { quality: string; url: string; size?: number }[];
  episodes?: { num: number; title: string; thumbnail?: string }[];
};

/**
 * Unified resolve — given a UnifiedItem, return playable stream/embed info.
 * Falls back across sources if primary fails.
 */
export async function unifiedResolve(
  item: UnifiedItem,
  season?: number,
  episode?: number
): Promise<ResolveResult> {
  // Strategy 1: NetMirror items — fetch detail to get MovieBox subjectid, then play
  if (item.source === "netmirror") {
    try {
      const result: ResolveResult = await netmirror.resolve(item, season, episode) as ResolveResult;
      if (result.streamUrl || result.embedUrl || result.streams?.length) {
        return result;
      }
    } catch {}
  }

  // Strategy 2: HindiDubAnime items — use the HDA-specific resolver (NOT moviebox)
  if (item.source === "hindidubanime") {
    try {
      const result: ResolveResult = await hindidubanime.resolve(item, season, episode) as ResolveResult;
      if (result.streamUrl || result.embedUrl || result.episodes?.length) {
        return result;
      }
    } catch {}
  }

  // Strategy 3: Items with a real MovieBox subjectid (e.g. NetMirror pre-resolved) — use MovieBox resolver
  // Skip this for HDA items since their movieboxSubjectId is actually a slug, not a subjectid.
  if (item.movieboxSubjectId && item.source !== "hindidubanime") {
    const mbItem: UnifiedItem = { ...item, id: item.movieboxSubjectId, source: "moviebox" };
    try {
      const mbResult: ResolveResult = await moviebox.resolve(mbItem, season, episode) as ResolveResult;
      if (mbResult.streamUrl || mbResult.embedUrl || mbResult.streams?.length) {
        return mbResult;
      }
    } catch {}
  }

  // Strategy 4: Use the item's own source
  const src = SOURCES.find((s) => s.id === item.source);
  if (src) {
    try {
      const result: ResolveResult = await src.resolve(item, season, episode) as ResolveResult;
      if (result.streamUrl || result.embedUrl || result.streams?.length) {
        return result;
      }
    } catch {}
  }

  // Strategy 5: Fall back to Fmovies direct embed (if we have an imdb_id)
  const imdb = (item as any).imdbId || (item as any).imdb_id;
  if (imdb) {
    try {
      const fmResult: ResolveResult = await fmovies.resolve(item, season, episode) as ResolveResult;
      if (fmResult.embedUrl) return fmResult;
    } catch {}
  }

  return {};
}

/**
 * Get home content — used for the landing page when no search is active.
 * Returns MovieBox home (richest) + HindiDubAnime browse (anime section).
 * Each source has its own timeout so a slow source doesn't block the others.
 */
export async function getUnifiedHome(): Promise<{
  sections: { title: string; items: UnifiedItem[] }[];
}> {
  try {
    // Fetch MovieBox home directly (fast — 1-2s)
    // HindiDubAnime is fetched with a strict timeout (it can be slow/unreachable
    // from this server's location).
    const [home, anime] = await Promise.all([
      fetchHomeDirectSafe(8000),
      safeAll(hindidubanime.browse!(1), 6000),
    ]);

    const sections: { title: string; items: UnifiedItem[] }[] = [];

    // MovieBox sections come back already grouped
    if (home?.sections?.length) {
      for (const s of home.sections.slice(0, 15)) {  // increased from 8 to 15 sections
        const items: UnifiedItem[] = (s.items || []).map((m: any) => ({
          id: String(m.id),
          source: "moviebox" as const,
          type: m.type,
          title: m.title,
          year: m.year,
          rating: m.rating,
          genres: m.genres || [],
          overview: m.overview,
          poster: m.posterUrl,
          backdrop: m.coverUrl,
          runtime: m.durationSeconds ? Math.round(m.durationSeconds / 60) : undefined,
          country: m.country,
          language: m.language,
          duration: m.duration,
        }));
        if (items.length) sections.push({ title: s.title, items });
      }
    }

    // Append anime section (only if it returned items)
    if (anime.length) {
      sections.push({ title: "Hindi Dub Anime", items: anime });
    }

    return { sections };
  } catch {
    return { sections: [] };
  }
}

async function fetchHomeDirectSafe(ms = 8000) {
  try {
    return await Promise.race([
      fetchHomeDirect(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

// Re-exports for convenience
export { moviebox, netmirror, fmovies, hindidubanime };
export type { UnifiedItem, SourceId } from "./types";
