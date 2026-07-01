/**
 * Unified Source Interface — all sources implement this.
 *
 * The app fires queries against ALL sources in parallel, merges results,
 * and never asks the user to pick a source. Each item carries a `source`
 * tag so the player knows how to play it.
 */

export type SourceId =
  | "moviebox"
  | "netmirror"
  | "fmovies"
  | "hindidubanime"
  | "animevilla";

export interface UnifiedItem {
  id: string;            // unique within source
  source: SourceId;
  type: "movie" | "tv";
  title: string;
  year?: string | number;
  rating?: number;
  genres: string[];
  overview?: string;
  poster?: string;
  backdrop?: string;
  runtime?: number;
  country?: string;
  language?: string;
  duration?: string;
  seasons?: number;
  // For sources that pre-resolve a stream URL (e.g. fmovies direct embed),
  // we stash it here so the player can play without a detail round-trip.
  embedUrl?: string;
  streamUrl?: string;
  // Cross-source link: when a source returns a MovieBox subjectid (NetMirror does),
  // we can reuse the MovieBox play endpoint instead of going through embed scraping.
  movieboxSubjectId?: string;
  // For TV sources, season/episode context if known at search time
  season?: number;
  episode?: number;
  episodeCount?: number;
  // For HindiDubAnime: episode list per anime
  episodes?: { num: number; title: string; link: string; thumbnail?: string }[];
}

export interface SourceClient {
  id: SourceId;
  name: string;
  /** Search this source. Empty string returns home/trending. */
  search(keyword: string, page?: number): Promise<UnifiedItem[]>;
  /** Fetch detail + available streams for one item. */
  resolve(item: UnifiedItem, season?: number, episode?: number): Promise<{
    streamUrl?: string;
    embedUrl?: string;
    streams?: { quality: string; url: string; size?: number }[];
    episodes?: { num: number; title: string; thumbnail?: string }[];
  }>;
  /** Whether this source can be browsed without a search (home/trending) */
  browsable: boolean;
  /** Browse home/trending — used when search box is empty */
  browse?(page?: number): Promise<UnifiedItem[]>;
}

// Helper: run with timeout, return [] on failure
export async function safeAll<T>(p: Promise<T[]>, ms = 8000): Promise<T[]> {
  try {
    return await Promise.race([
      p,
      new Promise<T[]>((resolve) => setTimeout(() => resolve([]), ms)),
    ]);
  } catch {
    return [];
  }
}

// Helper: dedupe by title+year, prioritizing the first source seen
export function dedupeItems(items: UnifiedItem[]): UnifiedItem[] {
  const seen = new Map<string, UnifiedItem>();
  for (const it of items) {
    const key = `${it.title.toLowerCase().trim()}|${it.year || ""}|${it.type}`;
    if (!seen.has(key)) seen.set(key, it);
  }
  return Array.from(seen.values());
}

// Helper: normalize a poster URL to https
export function https(u?: string): string | undefined {
  if (!u) return undefined;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}
