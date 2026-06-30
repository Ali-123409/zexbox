/**
 * HLS Proxy for HindiDubAnime streams.
 * The as-cdn21.top HLS URLs are IP-locked (token generated for our server's IP).
 * This proxy fetches the playlist server-side, rewrites all URLs to also go
 * through this proxy, and returns CORS-enabled content.
 *
 * Key fixes (were lost during force push, now restored):
 * 1. Binary-safe reading (ArrayBuffer, not text — prevents segment corruption)
 * 2. URI rewriting for ALL HLS tags (not just KEY/MAP — fixes #EXT-X-MEDIA)
 * 3. Double-encoding fix (decode before re-encode — fixes %253D → %3D)
 * 4. Content-based detection (check #EXTM3U bytes, not file extension —
 *    as-cdn21 disguises .ts segments as .js/.css/.woff)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

const streamCache = new Map<string, { streamUrl: string; expiresAt: number }>();
const CACHE_TTL = 50 * 60 * 1000;

async function getStreamUrl(embedUrl: string): Promise<string | undefined> {
  const idMatch = embedUrl.match(/\/video\/([a-zA-Z0-9]+)/);
  if (!idMatch) return undefined;
  const videoId = idMatch[1];

  const cached = streamCache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) return cached.streamUrl;

  const apiUrl = `https://as-cdn21.top/player/index.php?data=${videoId}&do=getVideo`;
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Referer": embedUrl,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "",
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const streamUrl = data.videoSource || data.securedLink;
    if (!streamUrl) return undefined;
    streamCache.set(videoId, { streamUrl, expiresAt: Date.now() + CACHE_TTL });
    return streamUrl;
  } catch { return undefined; }
}

/** Rewrite all URLs in an HLS playlist to route through this proxy. */
function rewritePlaylist(playlist: string, baseUrl: string, embedUrl: string): string {
  const lines = playlist.split("\n");
  const rewritten: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      // Rewrite URI="..." in ANY tag (KEY, MAP, MEDIA, I-FRAME-STREAM-INF, etc.)
      if (trimmed.startsWith("#") && trimmed.includes('URI="')) {
        const uriMatch = trimmed.match(/URI="([^"]+)"/);
        if (uriMatch) {
          const originalUri = uriMatch[1];
          const absoluteUri = resolveUrl(originalUri, baseUrl);
          const proxiedUri = `/api/hls-proxy?url=${encodeURIComponent(absoluteUri)}&embed=${encodeURIComponent(embedUrl)}`;
          rewritten.push(trimmed.replace(`URI="${originalUri}"`, `URI="${proxiedUri}"`));
          continue;
        }
      }
      rewritten.push(line);
      continue;
    }

    // URL line (variant playlist or segment)
    const absoluteUrl = resolveUrl(trimmed, baseUrl);
    const proxiedUrl = `/api/hls-proxy?url=${encodeURIComponent(absoluteUrl)}&embed=${encodeURIComponent(embedUrl)}`;
    rewritten.push(proxiedUrl);
  }

  return rewritten.join("\n");
}

/** Resolve a possibly-relative URL against a base URL.
 *  Decodes any existing percent-encoding to avoid double-encoding. */
function resolveUrl(url: string, baseUrl: string): string {
  let decoded = url;
  try {
    decoded = decodeURIComponent(decoded);
    decoded = decodeURIComponent(decoded);
  } catch {}
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
  try { return new URL(decoded, baseUrl).href; } catch { return decoded; }
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  const embedUrl = req.nextUrl.searchParams.get("embed") || "";

  if (!targetUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  // If the URL is an as-cdn21.top embed page, get the actual stream URL first
  let hlsUrl = targetUrl;
  if (targetUrl.includes("as-cdn21.top/video/")) {
    const freshUrl = await getStreamUrl(targetUrl);
    if (!freshUrl) return NextResponse.json({ error: "Failed to get stream URL" }, { status: 502 });
    hlsUrl = freshUrl;
  }

  try {
    const res = await fetch(hlsUrl, {
      headers: { "User-Agent": UA, "Referer": "https://as-cdn21.top/", Accept: "*/*" },
    });

    if (!res.ok) {
      // If 403, try getting a fresh token
      if (res.status === 403 && embedUrl) {
        const freshUrl = await getStreamUrl(embedUrl);
        if (freshUrl && freshUrl !== hlsUrl) {
          const retryRes = await fetch(freshUrl, {
            headers: { "User-Agent": UA, "Referer": "https://as-cdn21.top/", Accept: "*/*" },
          });
          if (retryRes.ok) {
            const buffer = await retryRes.arrayBuffer();
            return makeResponse(buffer, freshUrl, embedUrl);
          }
        }
      }
      return NextResponse.json({ error: `HLS fetch failed (HTTP ${res.status})` }, { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    return makeResponse(buffer, hlsUrl, embedUrl);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "fetch failed" }, { status: 502 });
  }
}

/** Determine if the response is a playlist or a binary segment, and return appropriately. */
function makeResponse(buffer: ArrayBuffer, baseUrl: string, embedUrl: string): NextResponse {
  const bytes = new Uint8Array(buffer);

  // Check if content starts with #EXTM3U (ASCII bytes: 0x23 0x45 0x58 0x54 0x4D 0x33 0x55)
  const isPlaylist = bytes.length >= 7 &&
    bytes[0] === 0x23 && bytes[1] === 0x45 && bytes[2] === 0x58 &&
    bytes[3] === 0x54 && bytes[4] === 0x4D && bytes[5] === 0x33 && bytes[6] === 0x55;

  if (isPlaylist) {
    const text = new TextDecoder().decode(buffer);
    const rewritten = rewritePlaylist(text, baseUrl, embedUrl);
    return new NextResponse(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Binary segment (MPEG-TS, possibly disguised as .js/.css/.woff)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "video/mp2t",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
