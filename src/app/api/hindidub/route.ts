/**
 * HindiDubAnime stream extractor.
 *
 * Episode pages on hindidubanime.com contain an iframe pointing to a player
 * (typically abyssplayer.com, filelions.xyz, or similar). That player iframe
 * in turn loads a Google Storage MP4 or HLS stream.
 *
 * We do a 2-step fetch here:
 *   1. Fetch episode HTML → extract iframe src
 *   2. Fetch iframe HTML → extract .mp4/.m3u8 source
 *
 * Both fetches are server-side because:
 *   - hindidubanime.com doesn't send CORS headers
 *   - The player iframe also blocks cross-origin requests
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function extractStreamUrls(html: string): { embedUrl?: string; streamUrl?: string } {
  // Find iframe src
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  let embedUrl: string | undefined;
  if (iframeMatch) {
    let src = iframeMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    embedUrl = src;
  }

  // Find direct video source
  const sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i);
  if (sourceMatch) {
    let src = sourceMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    return { embedUrl, streamUrl: src };
  }

  // Find .mp4 or .m3u8 anywhere in the HTML
  const streamMatch = html.match(/(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*)/i);
  if (streamMatch) {
    return { embedUrl, streamUrl: streamMatch[1] };
  }

  // Find storage.googleapis.com pattern (hindidubanime uses this)
  const gsMatch = html.match(/(https?:\/\/storage\.googleapis\.com\/[^\s"'<>]+)/i);
  if (gsMatch) {
    return { embedUrl, streamUrl: gsMatch[1] };
  }

  return embedUrl ? { embedUrl } : {};
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
  } catch (e: any) {
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

  const result = extractStreamUrls(ep.text);

  // Step 2: if we got an embed URL, fetch it too to find direct stream
  if (result.embedUrl && !result.streamUrl) {
    const player = await fetchWithTimeout(result.embedUrl, 12000);
    if (player.ok) {
      const nested = extractStreamUrls(player.text);
      if (nested.streamUrl) {
        return NextResponse.json({
          embedUrl: result.embedUrl,
          streamUrl: nested.streamUrl,
        });
      }
      // Return embedUrl as fallback (iframe player can still play it)
      return NextResponse.json({ embedUrl: result.embedUrl });
    }
    return NextResponse.json({ embedUrl: result.embedUrl });
  }

  if (result.streamUrl || result.embedUrl) {
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "No stream URL found in episode page" },
    { status: 404 }
  );
}
