/**
 * Direct browser → MovieBox h5-api client
 *
 * The h5-api (h5-api.aoneroom.com) is CORS-enabled and PUBLIC — no signing needed.
 * Calling it directly from the browser skips our server as middleman, which:
 *   - Eliminates one network hop (browser → our server → MovieBox → our server → browser)
 *   - Allows the browser to cache the response with HTTP cache
 *   - Reduces home page load from 6s → 1.3s
 *
 * We still use our /api/moviebox proxy for SIGNED endpoints (detail, play-info, search/v2)
 * that require the guest JWT — those can't be called directly from the browser.
 *
 * Client-side cache (localStorage): home data is cached for 5 minutes, so subsequent
 * page loads are instant (0ms network). Stale-while-revalidate pattern: show cached
 * data immediately, refresh in background.
 */

import { optimizeImage } from "./image";

const H5_HOST = "https://h5-api.aoneroom.com";
const H5_BASE_PATH = "/wefeed-h5api-bff";

// === Client-side cache (localStorage) ===
const CACHE_PREFIX = "zexbox:";
const HOME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null;
    return data as T;
  } catch {
    return null;
  }
}

function cacheSet(key: string, data: any, ttl: number = HOME_CACHE_TTL): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiresAt: Date.now() + ttl }));
  } catch {
    // localStorage full or disabled — silently skip
  }
}

export interface MovieItem {
  id: string;
  type: "movie" | "tv";
  title: string;
  posterUrl?: string;
  coverUrl?: string;
  rating?: number;
  year?: string;
  releaseDate?: string;
  genre?: string;
  genres: string[];
  country?: string;
  language?: string;
  duration?: string;
  durationSeconds?: number;
  overview?: string;
  description?: string;
}

// Trim a raw subject into our compact shape
function trimItem(it: any): MovieItem | null {
  const id = String(it.subjectId || it.id || "");
  const title = it.title || it.name || "Untitled";
  if (!id || !title) return null;
  return {
    id,
    type: Number(it.subjectType) === 2 || Number(it.subjectType) === 4 ? "tv" : "movie",
    title,
    posterUrl: it.cover?.url || it.posterUrl,
    coverUrl: it.cover?.url,
    rating: Number(it.imdbRatingValue) || undefined,
    year: it.releaseDate ? String(it.releaseDate).slice(0, 4) : undefined,
    releaseDate: it.releaseDate,
    genre: it.genre,
    genres: typeof it.genre === "string" ? it.genre.split(/[,/|]/).map((g) => g.trim()).filter(Boolean) : [],
    country: it.countryName,
    language: it.language,
    duration: it.duration,
    durationSeconds: it.durationSeconds,
    overview: (it.description || "").slice(0, 300),
  };
}

function trimItems(items: any[]): MovieItem[] {
  return items.map(trimItem).filter(Boolean) as MovieItem[];
}

function parseHomeResponse(raw: any) {
  const operating: any[] = raw?.data?.operatingList || [];
  const platformList: any[] = raw?.data?.platformList || [];

  const sections = operating
    .filter((op) => op.type !== "BANNER" && op.subjects?.length > 0)
    .map((op) => ({
      title: op.title || op.type,
      type: op.type,
      items: trimItems(op.subjects).slice(0, 12),
    }))
    .filter((s: any) => s.items.length > 0);

  const heroItems = sections[0]?.items?.slice(0, 6) || [];

  return {
    banners: heroItems,
    sections,
    platforms: platformList.map((p) => ({ name: p.name })),
  };
}

/**
 * Fetch home data directly from MovieBox h5-api.
 * Uses stale-while-revalidate: returns cached data immediately if available,
 * then refreshes in background.
 */
export async function fetchHomeDirect(): Promise<{ banners: MovieItem[]; sections: { title: string; type: string; items: MovieItem[] }[]; platforms: { name: string }[] }> {
  // 1. Check localStorage cache first (instant)
  const cached = cacheGet<any>("home");
  if (cached) {
    // Refresh in background (don't await)
    refreshHomeInBackground();
    return cached;
  }

  // 2. No cache — fetch fresh
  const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/home?host=movie-box.co`, {
    headers: { Accept: "application/json" },
  });
  const raw = await res.json();
  const parsed = parseHomeResponse(raw);

  // Save to cache
  cacheSet("home", parsed, HOME_CACHE_TTL);

  return parsed;
}

// Background refresh — doesn't block the UI
let refreshing = false;
async function refreshHomeInBackground() {
  if (refreshing) return;
  refreshing = true;
  try {
    const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/home?host=movie-box.co&_=${Date.now()}`, {
      headers: { Accept: "application/json" },
    });
    const raw = await res.json();
    const parsed = parseHomeResponse(raw);
    cacheSet("home", parsed, HOME_CACHE_TTL);
  } catch {
    // silent — keep old cache
  } finally {
    refreshing = false;
  }
}

/**
 * Fetch trending directly from h5-api (also cached client-side, 5 min).
 */
export async function fetchTrendingDirect(page = 0, perPage = 18): Promise<MovieItem[]> {
  const cacheKey = `trending:${page}:${perPage}`;
  const cached = cacheGet<MovieItem[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `${H5_HOST}${H5_BASE_PATH}/subject/trending?page=${page}&perPage=${perPage}`,
    { headers: { Accept: "application/json" } }
  );
  const raw = await res.json();
  const items = trimItems(raw?.data?.subjectList || []);
  cacheSet(cacheKey, items, HOME_CACHE_TTL);
  return items;
}

export { optimizeImage };

