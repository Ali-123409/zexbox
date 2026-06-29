/**
 * HindiDubAnime search proxy.
 *
 * hindidubanime.com does NOT send CORS headers, so the browser can't call
 * its WP REST API directly. This server-side proxy fetches anime lists/search
 * results and returns them to the browser with CORS headers enabled.
 *
 * GET /api/hda?action=search&keyword=demon&page=0
 * GET /api/hda?action=browse&page=1
 * Returns: { items: UnifiedItem[] }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP = "https://hindidubanime.com/wp-json/wp/v2";

// In-memory cache (5 min TTL — HDA is slow, so cache aggressively)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

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

function https(u?: string): string | undefined {
  if (!u) return undefined;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}

function animePoster(a: any): string | undefined {
  const fm = a._embedded?.["wp:featuredmedia"];
  if (Array.isArray(fm) && fm[0]) {
    return https(fm[0].source_url);
  }
  return undefined;
}

function animeToUnified(a: any) {
  const rawTitle = stripTags(a.title?.rendered || "");
  if (!rawTitle) return null;

  const isHindiSub = /hindi\s*sub/i.test(rawTitle);
  const isHindiDub = /hindi\s*dub/i.test(rawTitle);
  const lang = isHindiSub ? "Hindi Sub" : isHindiDub ? "Hindi Dub" : "Hindi";

  const cleanTitle = rawTitle
    .replace(/\s*\(Hindi[^)]*\)\s*/i, "")
    .replace(/\s*Hindi\s*Subtitle\s*$/i, "")
    .replace(/\s+Hindi\s*Subbed\s*$/i, "")
    .replace(/\s+Hindi\s*Dubbed\s*$/i, "")
    .replace(/\s+Hindi\s*Sub\s*$/i, "")
    .replace(/\s+Hindi\s*Dub\s*$/i, "")
    .replace(/\s+Hindi\s*$/i, "")
    .trim() || rawTitle;

  const slug = a.slug || "";
  const poster = animePoster(a) || `/api/hda-poster?slug=${encodeURIComponent(slug)}`;

  return {
    id: String(a.id),
    source: "hindidubanime" as const,
    type: "tv" as const,
    title: cleanTitle,
    poster,
    backdrop: poster,
    overview: stripTags(a.excerpt?.rendered || ""),
    language: lang,
    genres: ["Anime"],
    country: "Japan",
    movieboxSubjectId: slug,
  };
}

async function fetchWithRetry(url: string, ms = 15000, retries = 3): Promise<{ ok: boolean; data: any; status: number }> {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" },
        signal: ctrl.signal,
      });
      const data = await res.json();
      clearTimeout(t);
      return { ok: res.ok, data, status: res.status };
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
  return { ok: false, data: [], status: 0 };
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "browse";
  const keyword = req.nextUrl.searchParams.get("keyword") || "";
  const page = Number(req.nextUrl.searchParams.get("page") || "0");

  const cacheKey = `${action}:${keyword}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  let url: string;
  if (action === "search" && keyword.trim()) {
    url = `${WP}/anime?search=${encodeURIComponent(keyword)}&per_page=20&page=${page + 1}&_embed=1&_fields=id,slug,link,title,excerpt,featured_media,_embedded`;
  } else {
    // browse
    url = `${WP}/anime?per_page=20&page=${page + 1}&_embed=1&_fields=id,slug,link,title,excerpt,featured_media,_embedded`;
  }

  const res = await fetchWithRetry(url, 15000, 3);
  if (!res.ok) {
    return NextResponse.json({ items: [], error: `HDA fetch failed (HTTP ${res.status})` }, { status: 502 });
  }

  const items = (Array.isArray(res.data) ? res.data : []).map(animeToUnified).filter(Boolean);
  const data = { items };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
  return NextResponse.json(data);
}
