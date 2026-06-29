/**
 * HindiDubAnime poster extractor.
 *
 * The WP REST API for /wp-json/wp/v2/anime doesn't include the poster image
 * (featured_media is always 0). The poster is loaded via a lazyload <img>
 * with data-src attribute on the anime HTML page, typically pointing to
 * cdn.myanimelist.net/images/anime/...
 *
 * This endpoint fetches the anime page, extracts the poster URL, and
 * REDIRECTS to it (302). This way it can be used directly as an <img src>.
 *
 * In-memory cache (1 hour TTL) avoids re-fetching the same anime page.
 *
 * GET /api/hda-poster?slug={anime-slug}
 * Returns: 302 redirect to the poster image URL
 *          (or 404 if no poster found)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// In-memory cache (1 hour TTL) — anime posters don't change often
const posterCache = new Map<string, { poster: string; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

async function fetchWithTimeout(url: string, ms = 10000): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: ctrl.signal,
    });
    const text = await res.text();
    clearTimeout(t);
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  }
}

/**
 * Fetch with retry — HDA is intermittently unreachable from some regions.
 */
async function fetchWithRetry(url: string, ms = 10000, retries = 3): Promise<{ ok: boolean; text: string; status: number }> {
  for (let i = 0; i < retries; i++) {
    const result = await fetchWithTimeout(url, ms);
    if (result.ok && result.text.length > 500) return result;
    if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
  }
  return { ok: false, text: "", status: 0 };
}

function extractPoster(html: string): string | undefined {
  // Pattern 1: data-src='https://cdn.myanimelist.net/images/anime/...'
  let m = html.match(/data-src=['"](https?:\/\/cdn\.myanimelist\.net\/images\/anime\/[^'"]+)['"]/i);
  if (m) return m[1];

  // Pattern 2: og:image meta tag
  m = html.match(/<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/i);
  if (m) return m[1];

  // Pattern 3: any img with class containing 'thumb' or 'poster' or 'cover'
  m = html.match(/<img[^>]*class=['"][^'"]*(?:thumb|poster|cover|featured)[^'"]*['"][^>]*?(?:data-src|src)=['"]([^'"]+)['"]/i);
  if (m) return m[1];

  // Pattern 4: any cdn.myanimelist.net image with /anime/ in path (the poster)
  m = html.match(/(https?:\/\/cdn\.myanimelist\.net\/images\/anime\/[^\s"'<>]+)/i);
  if (m) return m[1];

  return undefined;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug param" }, { status: 400 });
  }

  // Check cache
  const cached = posterCache.get(slug);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.redirect(cached.poster, { status: 302 });
  }

  // Fetch the anime page (with retry — HDA is flaky)
  const url = `https://hindidubanime.com/anime/${slug}/`;
  const res = await fetchWithRetry(url, 10000, 3);
  if (!res.ok) {
    // Return a placeholder image instead of an error so the <img> doesn't break.
    // NOTE: We deliberately DON'T cache failures — next request may succeed.
    return NextResponse.redirect(
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMzAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzFhMWExZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIG9wYWNpdHk9IjAuNCI+Tm8gUG9zdGVyPC90ZXh0Pjwvc3ZnPg==",
      { status: 302 }
    );
  }

  const poster = extractPoster(res.text);
  if (!poster) {
    // No poster found in HTML — also don't cache, page structure may change
    return NextResponse.redirect(
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMzAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzFhMWExZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIG9wYWNpdHk9IjAuNCI+Tm8gUG9zdGVyPC90ZXh0Pjwvc3ZnPg==",
      { status: 302 }
    );
  }

  // Cache success for 1 hour
  posterCache.set(slug, { poster, expiresAt: Date.now() + CACHE_TTL });

  return NextResponse.redirect(poster, { status: 302 });
}
