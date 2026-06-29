/**
 * HindiDubAnime stream extractor.
 *
 * Episode pages on hindidubanime.com contain an iframe pointing to a player
 * (typically as-cdn21.top, abyssplayer.com, filelions.xyz, or similar).
 *
 * Verified patterns from the episode HTML page:
 *   1. <iframe src='https://as-cdn21.top/video/{id}' ...>
 *   2. data-embed-id attributes with base64-encoded player URLs:
 *      - "RmFzdGR1Yg==:aHR0cHM6Ly9hcy1jZG4yMS50b3AvdmlkZW8vOTQ0YzcyM2Q3YTQzYWYxYTI0ZWZjMWZmYWQ5ZWI4OTI="
 *      - Format: base64(source_name):base64(player_url)
 *   3. <title>Tamon's B-Side Hindi Dubbed Episode 1 – hindiDubAnime</title>
 *
 * We extract:
 *   - The primary iframe src (embedUrl)
 *   - All alternate embed URLs (so UI can offer fallbacks)
 *   - The episode title from <title> tag
 *   - Whether there's a next episode (so UI can show "Next Episode" button)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

interface ExtractResult {
  embedUrl?: string;
  streamUrl?: string;
  alternates?: { name: string; url: string }[];
  title?: string;
  hasNext?: boolean;
  nextEpisodeUrl?: string;
}

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

function extractFromHtml(html: string): ExtractResult {
  const result: ExtractResult = {};

  // 1. Primary iframe src
  const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
  if (iframeMatch) {
    let src = iframeMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    result.embedUrl = src;
  }

  // 2. All data-embed-id attributes (base64-encoded player URLs)
  const alternates: { name: string; url: string }[] = [];
  const embedIdMatches = Array.from(html.matchAll(/data-embed-id=['"]([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)['"]/g));
  for (const m of embedIdMatches) {
    try {
      const name = Buffer.from(m[1], "base64").toString("utf-8");
      const url = Buffer.from(m[2], "base64").toString("utf-8");
      if (url.startsWith("http")) {
        alternates.push({ name, url });
      }
    } catch {}
  }
  if (alternates.length > 0) {
    result.alternates = alternates;
    // If no primary iframe src, use the first alternate
    if (!result.embedUrl && alternates[0]?.url) {
      result.embedUrl = alternates[0].url;
    }
  }

  // 3. Episode title from <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    // "Tamon's B-Side Hindi Dubbed Episode 1 – hindiDubAnime" → "Tamon's B-Side Hindi Dubbed Episode 1"
    let title = decodeHtml(titleMatch[1]);
    title = title.replace(/\s*[–-]\s*hindiDubAnime\s*$/i, "").trim();
    result.title = title;
  }

  // 4. Detect next episode link
  // Episode URLs follow pattern: /watch/{slug}-episode-{N}/
  const currentMatch = html.match(/\/watch\/([a-z0-9-]+)-episode-(\d+)\//i);
  if (currentMatch) {
    const slug = currentMatch[1];
    const epNum = Number(currentMatch[2]);
    const nextEpUrl = `https://hindidubanime.com/watch/${slug}-episode-${epNum + 1}/`;
    // Check if next episode link exists in the page
    if (html.includes(`${slug}-episode-${epNum + 1}/`)) {
      result.hasNext = true;
      result.nextEpisodeUrl = nextEpUrl;
    }
  }

  // 5. Direct stream URL (rare — usually the iframe player handles it)
  const streamMatch = html.match(/(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*)/i);
  if (streamMatch) {
    result.streamUrl = streamMatch[1];
  }

  return result;
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<{ ok: boolean; text: string; status: number }> {
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

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  // Step 1: fetch episode page
  const ep = await fetchWithTimeout(url, 15000);
  if (!ep.ok) {
    return NextResponse.json(
      { error: `Episode page fetch failed (HTTP ${ep.status})` },
      { status: 502 }
    );
  }

  const result = extractFromHtml(ep.text);

  // Step 2: if we got an embed URL but no direct stream, fetch the embed page
  // to try to extract a direct .mp4 URL (for download support)
  if (result.embedUrl && !result.streamUrl) {
    const player = await fetchWithTimeout(result.embedUrl, 10000);
    if (player.ok) {
      // Look for .mp4 or .m3u8 in the player page
      const streamMatch = player.text.match(/(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*)/i);
      if (streamMatch) {
        result.streamUrl = streamMatch[1];
      }
    }
  }

  if (result.embedUrl || result.streamUrl) {
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "No stream URL found in episode page" },
    { status: 404 }
  );
}
