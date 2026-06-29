/**
 * Fmovies source — uses TMDB for search, then direct embeds for playback
 *
 * Strategy:
 *   1. Search via TMDB public API (free, no key needed for v3 if we ship a demo key)
 *      - Actually, TMDB requires an API key. Instead we'll use the MovieBox search
 *        to get TMDB IDs and then construct Fmovies embed URLs.
 *   2. Direct embeds (verified alive 2026-06-29):
 *      - https://vidlink.pro/movie/{imdb_id}
 *      - https://vidlink.pro/tv/{imdb_id}/{season}/{episode}
 *      - https://vidfast.pro/movie/{imdb_id}
 *      - https://vidnest.fun/movie/{imdb_id}
 *      - https://player.vidzee.wtf/embed/movie/{imdb_id}
 *   3. For download: the embed page contains a .m3u8 or .mp4 in its JS.
 *      We expose the embed URL to the iframe player; for download, we'd need
 *      a server-side fetcher (deferred — for now, download falls back to MovieBox).
 *
 * Since Fmovies doesn't have its own search API, we leverage the MovieBox
 * catalog (which has imdb_id for many titles) and use Fmovies as a fallback
 * playback path when MovieBox streams fail.
 */

import type { SourceClient, UnifiedItem } from "./types";

const EMBED_HOSTS = [
  "https://vidlink.pro",
  "https://vidfast.pro",
  "https://vidnest.fun",
];

export const fmovies: SourceClient = {
  id: "fmovies",
  name: "Fmovies",
  browsable: false,

  async search(keyword) {
    // Fmovies has no public search API — we rely on the unified search
    // to also pull from MovieBox (which has imdb_ids). Here we return []
    // so the unified search doesn't double-up. Items that have an imdb_id
    // get an `fmoviesEmbed` field added by the unified resolver.
    return [];
  },

  async resolve(item, season, episode) {
    // We need an imdb_id. The unified resolver attaches it via item.embedUrl
    // when MovieBox returns one.
    const imdb = (item as any).imdbId || (item as any).imdb_id;
    if (!imdb) return {};

    const isTv = item.type === "tv" || season !== undefined;
    const host = EMBED_HOSTS[0]; // vidlink.pro
    const embedUrl = isTv
      ? `${host}/tv/${imdb}/${season || 1}/${episode || 1}`
      : `${host}/movie/${imdb}`;

    return { embedUrl };
  },
};

// Build Fmovies embed URL for any item that has an imdb_id.
// Used by the unified resolver.
export function buildFmoviesEmbed(imdbId: string, type: "movie" | "tv", season?: number, episode?: number): string {
  const host = EMBED_HOSTS[0];
  return type === "tv"
    ? `${host}/tv/${imdbId}/${season || 1}/${episode || 1}`
    : `${host}/movie/${imdbId}`;
}

// All embed hosts for an item (used when one fails — UI can offer alternates)
export function buildAllFmoviesEmbeds(imdbId: string, type: "movie" | "tv", season?: number, episode?: number): string[] {
  return EMBED_HOSTS.map((host) =>
    type === "tv"
      ? `${host}/tv/${imdbId}/${season || 1}/${episode || 1}`
      : `${host}/movie/${imdbId}`
  );
}
