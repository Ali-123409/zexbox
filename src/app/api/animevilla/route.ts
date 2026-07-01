/**
 * AnimeVilla catalog/search proxy.
 *
 * animevilla.org does NOT send CORS headers, so the browser can't call
 * its WP REST API directly. This server-side proxy fetches anime lists/search
 * results and returns them to the browser with CORS headers enabled.
 *
 * GET /api/animevilla?action=search&keyword=demon&page=0
 * GET /api/animevilla?action=browse&page=1
 * GET /api/animevilla?action=episodes&slug=gantz-hindi-dubbed-watch
 *
 * Returns: { items: UnifiedItem[] } | { episodes: [...], downloadLinks: [...] }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WP = "https://animevilla.org/wp-json/wp/v2";

// In-memory cache (10-min TTL — animevilla is moderately slow)
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000;

const UA =
  "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

function decodeHtml(s: string): string {
  return (s || "")
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

function cleanTitle(raw: string): string {
  let t = raw;
  t = t.replace(/\s*\(\d+\)\s*/g, " ");
  t = t.replace(/\s+Watch\s+.+?\s+(?:In\s+)?Hindi\s*$/i, "");
  t = t.replace(/\s+Watch\s+.+$/i, "");
  t = t
    .replace(/\s+Hindi\s+Dubbed\s*$/i, "")
    .replace(/\s+Hindi\s+Subbed\s*$/i, "")
    .replace(/\s+Hindi\s+Dub\s*$/i, "")
    .replace(/\s+Hindi\s+Sub\s*$/i, "")
    .replace(/\s+Hindi\s*$/i, "")
    .trim();
  return t || raw;
}

function animeToUnified(a: any) {
  const rawTitle = stripTags(a.title?.rendered || "");
  if (!rawTitle) return null;

  const isHindiSub = /hindi\s*sub/i.test(rawTitle);
  const lang = isHindiSub ? "Hindi Sub" : "Hindi Dub";

  const title = cleanTitle(rawTitle);
  const slug = a.slug || "";
  const poster = animePoster(a) || undefined;

  const epMatch = rawTitle.match(/\((\d+)\)/);
  const episodeCount = epMatch ? Number(epMatch[1]) : undefined;

  const genres: string[] = [];
  for (const termGroup of a._embedded?.["wp:term"] || []) {
    if (Array.isArray(termGroup)) {
      for (const term of termGroup) {
        if (term?.taxonomy === "genre" && term?.name) genres.push(term.name);
      }
    }
  }

  return {
    id: String(a.id),
    source: "animevilla" as const,
    type: "tv" as const,
    title,
    poster,
    backdrop: poster,
    overview: stripTags(a.excerpt?.rendered || ""),
    language: lang,
    genres: genres.length ? genres.slice(0, 5) : ["Anime"],
    country: "Japan",
    movieboxSubjectId: slug,
    episodeCount,
  };
}

async function fetchWithRetry(
  url: string,
  ms = 15000,
  retries = 3
): Promise<{ ok: boolean; data: any; status: number }> {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: ctrl.signal,
      });
      const data = await res.json();
      clearTimeout(t);
      return { ok: res.ok, data, status: res.status };
    } catch {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return { ok: false, data: [], status: 0 };
}

// Extract hsalinks.in batch download URLs from an anime page.
// HTML structure:
//   <div class="download-section-item">
//     <div class="download-section-item-res">S1 Episode 1-6 720p</div>
//     <div class="download-section-item-data">
//       <a class="download-section-item-link" href="https://hsalinks.in/...">HSA DD</a>
//     </div>
//   </div>
function extractDownloadLinks(html: string) {
  const links: { quality: string; range: string; url: string }[] = [];
  // Match the OUTER block div exactly (class="download-section-item" — not -res/-data/-link).
  // Use word-boundary-ish check via the closing quote.
  const blockRegex =
    /<div[^>]*class="download-section-item"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  // Inside each block: find the res text and the hsalinks URL
  const resRegex =
    /<div[^>]*class="download-section-item-res"[^>]*>([\s\S]*?)<\/div>/i;
  const urlRegex = /href="(https:\/\/hsalinks\.in\/[^"]+)"/i;

  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const inner = m[1];
    const resMatch = resRegex.exec(inner);
    const urlMatch = urlRegex.exec(inner);
    if (!urlMatch) continue; // skip blocks without a download link
    const rawLabel = stripTags(resMatch ? resMatch[1] : "").trim();
    // Parse label like "S1 Episode 1-6 720p" → range="S1 Episode 1-6", quality="720p"
    let range = rawLabel;
    let quality = "?";
    const qMatch = rawLabel.match(/\b(\d{3,4}p)\b/i);
    if (qMatch) {
      quality = qMatch[1];
      range = rawLabel.replace(qMatch[0], "").trim();
    }
    links.push({ quality, range, url: urlMatch[1] });
  }
  return links;
}

// Extract episode links (some animevilla anime have /watch/ URLs)
function extractEpisodeLinks(html: string, slug: string) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `href="(https:\\/\\/animevilla\\.org\\/watch\\/${escaped}-episode-(\\d+)\\/)"`,
    "gi"
  );
  const matches = Array.from(html.matchAll(pattern));
  const seen = new Set<number>();
  const episodes: { num: number; title: string; link: string }[] = [];
  for (const m of matches) {
    const num = Number(m[2]);
    if (seen.has(num)) continue;
    seen.add(num);
    episodes.push({ num, title: `Episode ${num}`, link: m[1] });
  }
  episodes.sort((a, b) => a.num - b.num);
  return episodes;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "browse";
  const keyword = req.nextUrl.searchParams.get("keyword") || "";
  const page = Number(req.nextUrl.searchParams.get("page") || "0");
  const slug = req.nextUrl.searchParams.get("slug") || "";

  const cacheKey = `${action}:${keyword}:${page}:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  // === Browse / Search ===
  if (action === "browse" || action === "search") {
    let url: string;
    // NOTE: _fields=_embedded does NOT actually embed featured media — omit _fields
    // entirely so _embed=1 works and poster URLs are included.
    if (action === "search" && keyword.trim()) {
      url = `${WP}/anime?search=${encodeURIComponent(keyword)}&per_page=20&page=${
        page + 1
      }&_embed=1`;
    } else {
      url = `${WP}/anime?per_page=20&page=${page + 1}&_embed=1`;
    }

    const res = await fetchWithRetry(url, 15000, 3);
    if (!res.ok) {
      return NextResponse.json(
        { items: [], error: `AnimeVilla fetch failed (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    const items = (Array.isArray(res.data) ? res.data : [])
      .map(animeToUnified)
      .filter(Boolean);
    const data = { items };
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
    return NextResponse.json(data);
  }

  // === Episodes + Download links ===
  if (action === "episodes" || action === "detail") {
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const animeUrl = `https://animevilla.org/anime/${slug}/`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(animeUrl, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Fetch failed (HTTP ${res.status})`, episodes: [], downloadLinks: [] },
          { status: 502 }
        );
      }
      const html = await res.text();
      const episodes = extractEpisodeLinks(html, slug);
      const downloadLinks = extractDownloadLinks(html);
      const data = {
        episodes,
        episodeCount: episodes.length,
        downloadLinks,
        link: animeUrl,
      };
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
      return NextResponse.json(data);
    } catch (e: any) {
      clearTimeout(t);
      return NextResponse.json(
        { error: e?.message || "Fetch failed", episodes: [], downloadLinks: [] },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
