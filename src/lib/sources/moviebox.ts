/**
 * MovieBox source adapter — wraps existing h5api.ts and use-moviebox hooks.
 *
 * MovieBox is the primary source. It has the richest catalog and verified
 * stream extraction (HLS + MP4 360p–1080p from hcdn3.hakunaymatata.com).
 */

import type { SourceClient, UnifiedItem } from "./types";
import { fetchHomeDirect, fetchTrendingDirect, searchDirect, fetchDetailDirect, fetchPlayDirect, fetchSeasonsDirect, fetchRecsDirect, type MovieItem } from "../h5api";

function fromMovieBox(m: MovieItem): UnifiedItem {
  return {
    id: String(m.id),
    source: "moviebox",
    type: m.type,
    title: m.title,
    year: m.year,
    rating: m.rating,
    genres: m.genres || [],
    overview: m.overview,
    poster: m.posterUrl,
    backdrop: m.coverUrl,
    runtime: m.durationSeconds ? Math.round(m.durationSeconds / 60) : undefined,
    country: m.country,
    language: m.language,
    duration: m.duration,
  };
}

export const moviebox: SourceClient = {
  id: "moviebox",
  name: "MovieBox",
  browsable: true,

  async browse(_page = 0) {
    try {
      const home = await fetchHomeDirect();
      // Return first 30 from all sections (most relevant)
      const items = home.sections.flatMap((s) => s.items).slice(0, 30);
      return items.map(fromMovieBox);
    } catch {
      return [];
    }
  },

  async search(keyword, _page = 0) {
    if (!keyword.trim()) return [];
    try {
      const items = await searchDirect(keyword);
      return items.map(fromMovieBox);
    } catch {
      return [];
    }
  },

  async resolve(item, season, episode) {
    try {
      const subjectId = String(item.id);

      // First, try to fetch detail (gets seasons/episodes metadata)
      const [detail, seasons] = await Promise.all([
        fetchDetailDirect(subjectId).catch(() => null),
        fetchSeasonsDirect(subjectId).catch(() => null),
      ]);

      const episodes: { num: number; title: string; thumbnail?: string }[] = [];
      if (seasons && Array.isArray(seasons)) {
        const targetSeason = season && seasons.find((s: any) => Number(s.seasonNumber || s.se) === season);
        if (targetSeason?.episodes) {
          for (const ep of targetSeason.episodes) {
            episodes.push({
              num: Number(ep.episodeNumber || ep.ep),
              title: ep.title || `Episode ${ep.episodeNumber || ep.ep}`,
              thumbnail: ep.cover?.url,
            });
          }
        }
      }

      // Fetch play streams
      const play = await fetchPlayDirect(subjectId, season, episode);
      const streams: { quality: string; url: string; size?: number }[] = [];

      // h5-api play returns streams in play.streams (mobile API format)
      for (const s of (play.streams || [])) {
        const url = s.url || s.playUrl || s.playURL;
        const quality = s.quality || s.resolution || s.definition || "?";
        if (url) streams.push({ quality: String(quality), url, size: s.size });
      }

      // Pick best embed/stream URL for the player
      // Prefer MP4 (downloadable) over HLS
      const mp4 = streams.find((s) => s.url.endsWith(".mp4") || s.quality.includes("1080"));
      const hls = streams.find((s) => s.url.includes(".m3u8"));

      return {
        streamUrl: mp4?.url || hls?.url,
        streams,
        episodes,
      };
    } catch {
      return {};
    }
  },
};
