/**
 * NetMirror search proxy.
 *
 * api2.imdb4.shop does NOT send CORS headers, so the browser can't call it
 * directly from zexbox.vercel.app. This server-side proxy fetches NetMirror
 * results and returns them to the browser with CORS headers enabled.
 *
 * GET /api/netmirror?action=search&keyword=demon+slayer&page=0
 * Returns: { items: UnifiedItem[], pager: {...} }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://api2.imdb4.shop";

// In-memory cache (2 min TTL)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 2 * 60 * 1000;

function https(u?: string): string | undefined {
  if (!u) return undefined;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}

function toUnified(r: any) {
  const id = String(r.id || "");
  const title = (r.title || "").trim();
  if (!id || !title) return null;
  return {
    id,
    source: "netmirror" as const,
    type: r.media_type === "tv" ? "tv" : "movie",
    title: title.replace(/\n/g, "").trim(),
    year: r.release_date ? String(r.release_date).slice(0, 4) : undefined,
    rating: Number(r.vote_average) || undefined,
    poster: https(r.backdrop_path || r.poster_path),
    backdrop: https(r.backdrop_path),
    genres: Array.isArray(r.genre) ? r.genre.map(String) : [],
    country: r.country,
    language: r.language,
    duration: r.duration,
    seasons: r.season?.length ? Math.max(...r.season.map((s: any) => s.se)) : undefined,
    movieboxSubjectId: r.subjectid,
    overview: r.overview,
  };
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "search";
  const keyword = req.nextUrl.searchParams.get("keyword") || "";
  const page = Number(req.nextUrl.searchParams.get("page") || "0");

  if (action === "search") {
    if (!keyword.trim()) return NextResponse.json({ items: [] });

    const cacheKey = `search:${keyword}:${page}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data);
    }

    const kw = encodeURIComponent(keyword.trim()).replace(/%20/g, "+");
    const url = `${API}/api/search2/${kw}?page=${page}`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Referer: "https://netmirror.global/",
          "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
        },
      });
      if (!res.ok) return NextResponse.json({ items: [], error: `HTTP ${res.status}` });
      const raw = await res.json();
      const results = raw?.results || [];
      const items = results.map(toUnified).filter(Boolean);
      const data = { items, pager: raw?.pager };
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ items: [], error: e?.message || "fetch failed" }, { status: 502 });
    }
  }

  if (action === "detail") {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const cacheKey = `detail:${id}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data);
    }

    try {
      const res = await fetch(`${API}/api/movie/${id}`, {
        headers: {
          Accept: "application/json",
          Referer: "https://netmirror.global/",
          "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
        },
      });
      if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
      const raw = await res.json();
      const data = { detail: raw?.results?.[0] || null };
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "fetch failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
