/**
 * HindiDubAnime episode list extractor.
 * Fetches the anime page and extracts real episode links.
 * GET /api/hda-episodes?slug={anime-slug}
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

async function fetchWithRetry(url: string, ms = 12000, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: ctrl.signal });
      const text = await res.text();
      clearTimeout(t);
      if (res.ok && text.length > 500) return { ok: true, text, status: res.status };
    } catch {}
    if (i < retries - 1) await new Promise(r => setTimeout(r, 200 * (i + 1)));
  }
  return { ok: false, text: "", status: 0 };
}

function extractEpisodes(html: string) {
  const pattern = /href="(https:\/\/hindidubanime\.com\/watch\/([a-z0-9-]+)-episode-(\d+)\/)"/gi;
  const matches = Array.from(html.matchAll(pattern));
  const seen = new Set<number>();
  const episodes: { num: number; title: string; link: string }[] = [];
  for (const m of matches) {
    const num = Number(m[3]);
    if (seen.has(num)) continue;
    seen.add(num);
    episodes.push({ num, title: `Episode ${num}`, link: m[1] });
  }
  episodes.sort((a, b) => a.num - b.num);
  return episodes;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const cacheKey = `ep:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return NextResponse.json(cached.data);

  const url = `https://hindidubanime.com/anime/${slug}/`;
  const res = await fetchWithRetry(url, 12000, 3);
  if (!res.ok) return NextResponse.json({ error: `Fetch failed (HTTP ${res.status})`, episodes: [] }, { status: 502 });

  const episodes = extractEpisodes(res.text);
  const data = { episodes, count: episodes.length };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
  return NextResponse.json(data);
}
