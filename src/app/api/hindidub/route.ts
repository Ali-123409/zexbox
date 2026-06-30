/**
 * HindiDubAnime stream extractor — BEAST MODE.
 * Extracts direct video URLs from ALL HDA player types.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

interface ExtractResult {
  embedUrl?: string;
  streamUrl?: string;
  alternates?: { name: string; url: string }[];
  title?: string;
  hasNext?: boolean;
  nextEpisodeUrl?: string;
  downloadUrl?: string;
  videoTitle?: string;
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g,"&").replace(/&#038;/g,"&").replace(/&#8217;/g,"'").replace(/&#8220;/g,'"').replace(/&#8221;/g,'"').replace(/&quot;/g,'"').replace(/&#8211;/g,"-").replace(/&#8212;/g,"—");
}

function extractFromHtml(html: string): ExtractResult {
  const result: ExtractResult = {};

  const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
  if (iframeMatch) {
    let src = iframeMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    result.embedUrl = src;
  }

  const alternates: { name: string; url: string }[] = [];
  for (const m of html.matchAll(/data-embed-id=['"]([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)['"]/g)) {
    try {
      const name = Buffer.from(m[1], "base64").toString("utf-8");
      const url = Buffer.from(m[2], "base64").toString("utf-8");
      if (url.startsWith("http")) alternates.push({ name, url });
    } catch {}
  }
  if (alternates.length > 0) {
    result.alternates = alternates;
    if (!result.embedUrl) result.embedUrl = alternates[0].url;
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = decodeHtml(titleMatch[1]);
    title = title.replace(/\s*[–-]\s*hindiDubAnime\s*$/i, "").trim();
    result.title = title;
  }

  const currentMatch = html.match(/\/watch\/([a-z0-9-]+)-episode-(\d+)\//i);
  if (currentMatch) {
    const slug = currentMatch[1];
    const epNum = Number(currentMatch[2]);
    if (html.includes(`${slug}-episode-${epNum + 1}/`)) {
      result.hasNext = true;
      result.nextEpisodeUrl = `https://hindidubanime.com/watch/${slug}-episode-${epNum + 1}/`;
    }
  }

  return result;
}

async function fetchWithTimeout(url: string, ms = 12000, options: RequestInit = {}): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*", ...(options.headers as Record<string, string> || {}) },
      signal: ctrl.signal, ...options,
    });
    const text = await res.text();
    clearTimeout(t);
    return { ok: res.ok, text, status: res.status };
  } catch { return { ok: false, text: "", status: 0 }; }
}

async function fetchWithRetry(url: string, ms = 12000, retries = 3, options: RequestInit = {}): Promise<{ ok: boolean; text: string; status: number }> {
  for (let i = 0; i < retries; i++) {
    const result = await fetchWithTimeout(url, ms, options);
    if (result.ok && result.text.length > 500) return result;
    if (i < retries - 1) await new Promise(r => setTimeout(r, 200 * (i + 1)));
  }
  return { ok: false, text: "", status: 0 };
}

/** Extract HLS stream URL from as-cdn21.top player via POST API. */
async function extractFromAsCdn21(embedUrl: string): Promise<{ streamUrl?: string }> {
  if (!embedUrl.includes("as-cdn21.top")) return {};
  const idMatch = embedUrl.match(/\/video\/([a-zA-Z0-9]+)/);
  if (!idMatch) return {};
  const videoId = idMatch[1];
  const apiUrl = `https://as-cdn21.top/player/index.php?data=${videoId}&do=getVideo`;
  const res = await fetchWithRetry(apiUrl, 10000, 3, {
    method: "POST",
    headers: { "Referer": embedUrl, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" },
    body: "",
  });
  if (!res.ok || res.text.length < 50) return {};
  try {
    const data = JSON.parse(res.text);
    return { streamUrl: data.videoSource || data.securedLink };
  } catch { return {}; }
}

/** Extract MKV URL from gdmirrorbot via iqsmartgames. */
async function extractFromGdmirrorbot(embedUrl: string): Promise<{ downloadUrl?: string; videoTitle?: string }> {
  if (!embedUrl.includes("gdmirrorbot.nl")) return {};
  const idMatch = embedUrl.match(/\/embed\/([a-zA-Z0-9]+)/);
  if (!idMatch) return {};
  const fileId = idMatch[1];
  const iqsmartUrl = `https://ddn.iqsmartgames.com/file/${fileId}`;
  const res = await fetchWithRetry(iqsmartUrl, 10000, 2, { headers: { "Referer": "https://gdmirrorbot.nl/" }, redirect: "follow" });
  if (!res.ok) return { downloadUrl: iqsmartUrl }; // Fallback: return the page URL for browser download
  const workersMatch = res.text.match(/(https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/[^"'<>\s]+)/i);
  if (workersMatch) {
    const downloadUrl = workersMatch[1].replace(/&amp;/g, "&");
    const titleMatch = res.text.match(/<title>([^<]+)<\/title>/i);
    return { downloadUrl, videoTitle: titleMatch ? decodeHtml(titleMatch[1]) : undefined };
  }
  return { downloadUrl: iqsmartUrl };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  const ep = await fetchWithRetry(url, 12000, 3);
  if (!ep.ok) return NextResponse.json({ error: `Episode fetch failed (HTTP ${ep.status})` }, { status: 502 });

  const result = extractFromHtml(ep.text);

  // Extract direct stream URLs from all available players
  if (result.embedUrl) {
    // as-cdn21.top → HLS stream (plays in native <video> via hls.js — NO ADS)
    if (result.embedUrl.includes("as-cdn21.top")) {
      const direct = await extractFromAsCdn21(result.embedUrl);
      if (direct.streamUrl) {
        // Route through HLS proxy (IP-locked URL needs server-side fetch)
        result.streamUrl = `/api/hls-proxy?url=${encodeURIComponent(result.embedUrl)}&embed=${encodeURIComponent(result.embedUrl)}`;
      }
    }

    // gdmirrorbot → MKV download URL
    if (result.embedUrl.includes("gdmirrorbot.nl")) {
      const mkv = await extractFromGdmirrorbot(result.embedUrl);
      if (mkv.downloadUrl) {
        result.downloadUrl = mkv.downloadUrl;
        if (mkv.videoTitle) result.videoTitle = mkv.videoTitle;
      }
    }

    // Check alternates for players we haven't tried yet
    if (result.alternates) {
      for (const alt of result.alternates) {
        if (!result.streamUrl && alt.url.includes("as-cdn21.top")) {
          const direct = await extractFromAsCdn21(alt.url);
          if (direct.streamUrl) {
            result.streamUrl = `/api/hls-proxy?url=${encodeURIComponent(alt.url)}&embed=${encodeURIComponent(alt.url)}`;
          }
        }
        if (!result.downloadUrl && alt.url.includes("gdmirrorbot.nl")) {
          const mkv = await extractFromGdmirrorbot(alt.url);
          if (mkv.downloadUrl) {
            result.downloadUrl = mkv.downloadUrl;
            if (mkv.videoTitle && !result.videoTitle) result.videoTitle = mkv.videoTitle;
          }
        }
      }
    }
  }

  if (result.embedUrl || result.streamUrl || result.downloadUrl) {
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "No stream URL found" }, { status: 404 });
}
