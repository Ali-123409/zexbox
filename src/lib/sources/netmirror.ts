/**
 * NetMirror source — wraps api2.imdb4.shop
 *
 * Verified endpoints (2026-06-29):
 *   GET https://api2.imdb4.shop/api/search2/{keyword}?page=0
 *     - keyword: encodeURIComponent, %20 → "+"
 *     - returns: { filters, pager, results[], sorters, system }
 *   GET https://api2.imdb4.shop/api/movie/{id}
 *     - returns same shape, results[0] has `subjectid` which is a MovieBox subject id
 *   GET https://api2.imdb4.shop/api/related/{id}?page=0
 *
 * Stream strategy:
 *   NetMirror wraps MovieBox. Each result has a `subjectid` field that maps 1:1
 *   to MovieBox's subjectId. We pass that to our existing MovieBox play proxy,
 *   which returns real MP4 streams (360p–1080p) from hcdn3.hakunaymatata.com.
 *
 * Genre IDs (from /api/movie response): "29"=Drama, "14"=Thriller, "15"=Action
 */

import type { SourceClient, UnifiedItem } from "./types";
import { https } from "./types";

const API = "https://api2.imdb4.shop";

interface NetMirrorResult {
  title?: string;
  id?: string | number;
  subjectid?: string;
  backdrop_path?: string;
  poster_path?: string;
  release_date?: string;
  media_type?: string; // "tv" or "movie"
  vote_average?: string | number;
  season?: { se: number; ep: number }[];
  genre?: string[];
  duration?: string;
  country?: string;
  overview?: string;
  // hindi-dubbed/anime flag
  language?: string;
}

function toUnified(r: NetMirrorResult): UnifiedItem | null {
  const id = String(r.id || "");
  const title = (r.title || "").trim();
  if (!id || !title) return null;
  return {
    id,
    source: "netmirror",
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
    seasons: r.season?.length ? Math.max(...r.season.map((s) => s.se)) : undefined,
    movieboxSubjectId: r.subjectid, // KEY: reuse MovieBox play endpoint
    overview: r.overview,
  };
}

export const netmirror: SourceClient = {
  id: "netmirror",
  name: "NetMirror",
  browsable: false,

  async search(keyword, page = 0) {
    if (!keyword.trim()) return [];
    const kw = encodeURIComponent(keyword.trim()).replace(/%20/g, "+");
    const url = `${API}/api/search2/${kw}?page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Referer: "https://netmirror.global/",
      },
    });
    if (!res.ok) return [];
    const raw = await res.json();
    const results: NetMirrorResult[] = raw?.results || [];
    return results.map(toUnified).filter(Boolean) as UnifiedItem[];
  },

  async resolve(item) {
    // NetMirror's /api/movie/{id} returns the subjectid (which IS a MovieBox
    // subjectId). We fetch it here so the unified resolver can play via MovieBox.
    try {
      const res = await fetch(`${API}/api/movie/${item.id}`, {
        headers: {
          Accept: "application/json",
          Referer: "https://netmirror.global/",
        },
      });
      if (!res.ok) return {};
      const raw = await res.json();
      const m: NetMirrorResult | undefined = raw?.results?.[0];
      if (!m) return {};
      const subjectid = m.subjectid;
      if (!subjectid) return {};
      // Return the subjectid — unified resolver will route through MovieBox.
      // We do this by setting movieboxSubjectId on the item and letting the
      // unified resolver pick it up. Since we can't mutate the item here,
      // we instead do the MovieBox resolve ourselves by calling our proxy.
      const playRes = await fetch(
        `/api/moviebox?action=play&subjectId=${subjectid}`
      );
      if (!playRes.ok) return {};
      const playData = await playRes.json();
      const streams = (playData.streams || []).map((s: any) => ({
        quality: String(s.quality || s.resolution || "?"),
        url: s.url || s.playUrl || "",
        size: s.size,
      })).filter((s: any) => s.url);
      if (streams.length === 0) return {};
      // Prefer MP4 for direct play
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
