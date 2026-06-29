/**
 * NetMirror source — wraps our /api/netmirror proxy
 *
 * The external API (api2.imdb4.shop) does NOT send CORS headers, so the browser
 * can't call it directly. We route through our own server-side proxy which
 * adds CORS headers and caches responses.
 *
 * Verified endpoints (2026-06-29):
 *   Search: GET /api/netmirror?action=search&keyword={kw}&page=0
 *   Detail: GET /api/netmirror?action=detail&id={id}
 *
 * Stream strategy:
 *   NetMirror's /api/movie/{id} returns a `subjectid` field that IS a MovieBox
 *   subject ID. We pass that to our existing MovieBox play proxy, which returns
 *   real MP4 streams (360p–1080p) from hcdn3.hakunaymatata.com.
 */

import type { SourceClient, UnifiedItem } from "./types";

interface NetMirrorResult {
  title?: string;
  id?: string | number;
  subjectid?: string;
  backdrop_path?: string;
  poster_path?: string;
  release_date?: string;
  media_type?: string;
  vote_average?: string | number;
  season?: { se: number; ep: number }[];
  genre?: string[];
  duration?: string;
  country?: string;
  overview?: string;
  language?: string;
}

export const netmirror: SourceClient = {
  id: "netmirror",
  name: "NetMirror",
  browsable: false,

  async search(keyword, page = 0) {
    if (!keyword.trim()) return [];
    try {
      const url = `/api/netmirror?action=search&keyword=${encodeURIComponent(keyword)}&page=${page}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const raw = await res.json();
      return (raw?.items || []) as UnifiedItem[];
    } catch {
      return [];
    }
  },

  async resolve(item) {
    // NetMirror's /api/movie/{id} returns the subjectid (which IS a MovieBox
    // subjectId). We fetch it here so the unified resolver can play via MovieBox.
    try {
      const res = await fetch(`/api/netmirror?action=detail&id=${item.id}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return {};
      const raw = await res.json();
      const m: NetMirrorResult | undefined = raw?.detail;
      if (!m) return {};
      const subjectid = m.subjectid;
      if (!subjectid) return {};

      // Route through MovieBox play endpoint
      const playRes = await fetch(`/api/moviebox?action=play&subjectId=${subjectid}`);
      if (!playRes.ok) return {};
      const playData = await playRes.json();
      const streams = (playData.streams || []).map((s: any) => ({
        quality: String(s.quality || s.resolution || s.resolutions || "?"),
        url: s.url || s.playUrl || "",
        size: s.size,
      })).filter((s: any) => s.url);
      if (streams.length === 0) return {};
      const mp4 = streams.find((s) => s.url.endsWith(".mp4"));
      return {
        streamUrl: mp4?.url || streams[0].url,
        streams,
      };
    } catch {
      return {};
    }
  },
};
