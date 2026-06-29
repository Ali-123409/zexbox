"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Download as DownloadIcon,
  User as UserIcon,
  Play,
  Plus,
  Check,
  Star,
  Coins,
  Gift,
  Tv,
  Film,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  X,
  Trash2,
  Bookmark,
  History,
  Sparkles,
  Flame,
  Award,
  Wifi,
  Loader2,
  AlertCircle,
  Globe,
  MoreHorizontal,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { CATALOG, Title, searchCatalog, ALL_GENRES, getByGenre } from "@/lib/catalog";
import type { MovieItem } from "@/lib/h5api";
import { fetchHomeDirect, fetchPlayDirect } from "@/lib/h5api";
import { optimizeImage } from "@/lib/image";
import { useMovieSearch, useDetail } from "@/lib/use-moviebox";
import { useUnifiedSearch, useUnifiedHome } from "@/lib/sources/hooks";
import { unifiedResolve, unifiedSearch } from "@/lib/sources";
import type { UnifiedItem } from "@/lib/sources/types";
import { buildFmoviesEmbed } from "@/lib/sources/fmovies";
import Player from "@/components/zexbox/Player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type View = "home" | "search" | "detail" | "downloads" | "profile" | "watchlist" | "history" | "movies" | "tv";

interface DisplayItem {
  id: string | number;
  type: "movie" | "tv";
  title: string;
  year?: string | number;
  rating?: number;
  ratingCount?: number;
  genres: string[];
  overview?: string;
  poster?: string;
  backdrop?: string;
  runtime?: number;
  cast?: string[];
  director?: string;
  seasons?: number;
  episodes?: number;
  country?: string;
  duration?: string;
  source: "catalog" | "moviebox" | "netmirror" | "fmovies" | "hindidubanime";
  // For sources that map back to MovieBox (NetMirror returns a subjectid)
  movieboxSubjectId?: string;
  // For items that pre-resolve a stream URL (HindiDubAnime direct mp4)
  embedUrl?: string;
  streamUrl?: string;
  // For Fmovies direct embed (imdb_id based)
  imdbId?: string;
  // For HindiDubAnime: episode list
  episodeList?: { num: number; title: string; link: string }[];
  // For tracking original source-specific data
  language?: string;
}

function toDisplay(t: Title): DisplayItem {
  return {
    id: t.id, type: t.type, title: t.title, year: t.year, rating: t.rating,
    genres: t.genres, overview: t.overview, poster: t.poster, backdrop: t.backdrop,
    runtime: t.runtime, cast: t.cast, director: t.director,
    seasons: t.seasons, episodes: t.episodes, source: "catalog",
  };
}

function fromMovieBox(m: MovieItem): DisplayItem {
  return {
    id: m.id, type: m.type, title: m.title, year: m.year, rating: m.rating,
    genres: m.genres, overview: m.overview || m.description,
    poster: m.posterUrl, backdrop: m.coverUrl,
    runtime: m.durationSeconds ? Math.round(m.durationSeconds / 60) : undefined,
    country: m.country, duration: m.duration, source: "moviebox",
  };
}

// Convert any UnifiedItem (from any source) to DisplayItem
function fromUnified(u: UnifiedItem): DisplayItem {
  return {
    id: u.id,
    type: u.type,
    title: u.title,
    year: u.year,
    rating: u.rating,
    genres: u.genres || [],
    overview: u.overview,
    poster: u.poster,
    backdrop: u.backdrop,
    runtime: u.runtime,
    country: u.country,
    duration: u.duration,
    seasons: u.seasons,
    source: u.source as any,
    movieboxSubjectId: u.movieboxSubjectId,
    embedUrl: u.embedUrl,
    streamUrl: u.streamUrl,
    language: u.language,
  };
}

interface DetailState { item: DisplayItem; episode?: string; }

// ====================== MAIN PAGE ======================
export default function Page() {
  const [view, setView] = useState<View>("home");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [player, setPlayer] = useState<{
    title: string;
    streamUrl?: string;
    embedUrl?: string;
    poster?: string;
    // TV show navigation
    seasonTabs?: number[];
    currentSeason?: number;
    currentEpisode?: number;
    maxEpisodes?: number;
    onSeasonChange?: (season: number) => void;
    onEpisodeChange?: (episode: number) => void;
  } | null>(null);

  const openDetail = (item: DisplayItem, episode?: string) => {
    setDetail({ item, episode });
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Ref to break circular dependency (playTitle references itself for TV navigation)
  const playTitleRef = useRef<(item: DisplayItem, episode?: string) => Promise<void>>(async () => {});

  const playTitle = useCallback(async (item: DisplayItem, episode?: string) => {
    // Parse episode info if provided (e.g. "S1E3")
    let se: number | undefined;
    let ep: number | undefined;
    if (episode) {
      const m = episode.match(/S(\d+)E(\d+)/i);
      if (m) {
        se = Number(m[1]);
        ep = Number(m[2]);
      }
    }

    // For TV shows that aren't from hindidubanime, default to S1E1 if no episode given
    if (item.type === "tv" && !se && item.source !== "hindidubanime") {
      se = 1; ep = 1;
    }

    // === Unified resolution path ===
    // Try the unified resolver first — it knows how to handle all sources
    // (moviebox, netmirror → moviebox, fmovies direct embed, hindidubanime iframe).
    try {
      const unifiedItem: UnifiedItem = {
        id: String(item.id),
        source: item.source as any,
        type: item.type,
        title: item.title,
        year: item.year as any,
        rating: item.rating,
        genres: item.genres,
        overview: item.overview,
        poster: item.poster,
        backdrop: item.backdrop,
        movieboxSubjectId: item.movieboxSubjectId,
        embedUrl: item.embedUrl,
        streamUrl: item.streamUrl,
      };

      const result = await unifiedResolve(unifiedItem, se, ep);

      // Build player state
      const playerState: any = {
        title: item.type === "tv" && episode ? `${item.title} - ${episode}` : item.title,
        streamUrl: result.streamUrl,
        embedUrl: result.embedUrl,
        poster: item.backdrop || item.poster,
      };

      // TV navigation for sources that support it
      if (item.type === "tv" && result.episodes?.length) {
        playerState.currentEpisode = ep || 1;
        playerState.maxEpisodes = result.episodes.length;
        playerState.currentSeason = se || 1;
        playerState.seasonTabs = [se || 1];
        playerState.onEpisodeChange = (newEp: number) => {
          playTitleRef.current(item, `S${se || 1}E${newEp}`);
        };
      }

      if (playerState.streamUrl || playerState.embedUrl) {
        setPlayer(playerState);
        useStore.getState().addToHistory({
          id: String(item.id),
          type: item.type, title: item.title, poster: item.poster || "",
          progress: 0, episode,
        });
        return;
      }
    } catch { /* fall through to fallbacks */ }

    // === Fallback: MovieBox direct (for moviebox/netmirror items, NOT hindidubanime) ===
    if ((item.source === "moviebox" || item.source === "netmirror" || item.movieboxSubjectId) && item.source !== "hindidubanime") {
      try {
        const subjectId = item.movieboxSubjectId || String(item.id);
        const result = await fetchPlayDirect(subjectId, se, ep);
        const allStreams = [
          ...(result.streams || []),
          ...(result.hls || []),
          ...(result.dash || []),
        ];
        if (allStreams.length > 0) {
          const best = allStreams.reduce((a: any, b: any) => {
            const aRes = Number(a.resolutions || a.resolution || 0);
            const bRes = Number(b.resolutions || b.resolution || 0);
            return aRes > bRes ? a : b;
          });
          const streamUrl = best.url || best.playUrl || best.streamUrl;
          if (streamUrl) {
            const isTv = item.type === "tv";
            const playerState: any = {
              title: isTv && episode ? `${item.title} - ${episode}` : item.title,
              streamUrl,
              poster: item.backdrop || item.poster,
            };

            if (isTv) {
              try {
                const seasonsRes = await fetch(`/api/moviebox?action=seasons&subjectId=${subjectId}`);
                const seasonsData = await seasonsRes.json();
                const seasons = seasonsData?.seasons?.seasons || [];
                if (seasons.length > 0) {
                  const currentSe = se || seasons[0].se;
                  const seasonInfo = seasons.find((s: any) => s.se === currentSe) || seasons[0];
                  const maxEp = seasonInfo?.maxEp || 10;
                  playerState.seasonTabs = seasons.map((s: any) => s.se);
                  playerState.currentSeason = currentSe;
                  playerState.currentEpisode = ep || 1;
                  playerState.maxEpisodes = maxEp;
                  playerState.onSeasonChange = (newSe: number) => playTitleRef.current(item, `S${newSe}E1`);
                  playerState.onEpisodeChange = (newEp: number) => playTitleRef.current(item, `S${currentSe}E${newEp}`);
                }
              } catch { /* navigation optional */ }
            }

            setPlayer(playerState);
            useStore.getState().addToHistory({
              id: String(item.id),
              type: item.type, title: item.title, poster: item.poster || "",
              progress: 0, episode,
            });
            return;
          }
        }
      } catch { /* fall through to embed */ }
    }

    // === Fallback: Fmovies direct embed (if we have an imdb_id) ===
    if (item.imdbId) {
      const embedUrl = buildFmoviesEmbed(item.imdbId, item.type, se, ep);
      setPlayer({
        title: item.type === "tv" && episode ? `${item.title} - ${episode}` : item.title,
        embedUrl,
        poster: item.backdrop || item.poster,
      });
      useStore.getState().addToHistory({
        id: String(item.id),
        type: item.type, title: item.title, poster: item.poster || "",
        progress: 0, episode,
      });
      return;
    }

    // === Final fallback: multiembed title search ===
    const isTv = item.type === "tv";
    let embedUrl: string;
    if (isTv && episode) {
      const m = episode.match(/S(\d+)E(\d+)/i);
      embedUrl = `https://multiembed.mov/?video_id=${item.id}&tmdb=1&s=${m ? m[1] : "1"}&e=${m ? m[2] : "1"}`;
    } else {
      const q = encodeURIComponent(`${item.title} ${item.year || ""}`.trim());
      embedUrl = `https://multiembed.mov/?search=${q}`;
    }
    setPlayer({
      title: isTv && episode ? `${item.title} - ${episode}` : item.title,
      embedUrl,
      poster: item.backdrop || item.poster,
    });
    useStore.getState().addToHistory({
      id: String(item.id),
      type: item.type, title: item.title, poster: item.poster || "",
      progress: 0, episode,
    });
  }, []);

  // Keep ref in sync so TV navigation callbacks can call the latest playTitle
  useEffect(() => {
    playTitleRef.current = playTitle;
  }, [playTitle]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0f] text-white" style={{ fontFamily: '"Segoe UI", "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif' }}>
      <Header view={view} setView={setView} />
      <main className="flex-1 pb-24">
        {view === "home" && <HomeView onOpen={openDetail} onPlay={playTitle} />}
        {view === "movies" && <CategoryView category="movie" onOpen={openDetail} />}
        {view === "tv" && <CategoryView category="tv" onOpen={openDetail} />}
        {view === "search" && <SearchView onOpen={openDetail} />}
        {view === "detail" && detail && (
          <DetailView item={detail.item} initialEpisode={detail.episode} onPlay={(ep) => playTitle(detail.item, ep)} onBack={() => setView("home")} onOpen={openDetail} />
        )}
        {view === "downloads" && <DownloadsView />}
        {view === "watchlist" && <WatchlistView onOpen={openDetail} />}
        {view === "history" && <HistoryView onOpen={openDetail} onPlay={playTitle} />}
        {view === "profile" && <ProfileView setView={setView} />}
      </main>
      <Footer />
      <BottomNav view={view} setView={setView} />
      {player && (
        <Player
          key={`${player.title}-${player.streamUrl || player.embedUrl}`}
          title={player.title}
          streamUrl={player.streamUrl}
          embedUrl={player.embedUrl}
          poster={player.poster}
          onClose={() => setPlayer(null)}
          seasonTabs={player.seasonTabs}
          currentSeason={player.currentSeason}
          currentEpisode={player.currentEpisode}
          maxEpisodes={player.maxEpisodes}
          onSeasonChange={player.onSeasonChange}
          onEpisodeChange={player.onEpisodeChange}
        />
      )}
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ====================== HEADER ======================
function Header({ view, setView }: { view: View; setView: (v: View) => void }) {
  const coins = useStore((s) => s.coins);
  const navItems: { v: View; label: string }[] = [
    { v: "home", label: "Home" },
    { v: "movies", label: "Movie" },
    { v: "tv", label: "TV Show" },
    { v: "downloads", label: "Downloads" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0d0d0f]/95 backdrop-blur-md border-b border-white/[0.06]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <button onClick={() => setView("home")} className="flex items-center gap-2 shrink-0" aria-label="Zex Box home">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-[#e50914] to-[#ff4d4d] flex items-center justify-center font-extrabold text-lg text-white shadow-lg shadow-red-600/20">
            Z
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight hidden sm:block">
            Zex<span className="text-[#e50914]">Box</span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((it) => (
            <button
              key={it.v}
              onClick={() => setView(it.v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                view === it.v ? "text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {it.label}
            </button>
          ))}
          <button
            onClick={() => setView("watchlist")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              view === "watchlist" ? "text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Watchlist
          </button>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setView("search")}
            className="p-2 rounded-full hover:bg-white/10 transition text-white/70 hover:text-white"
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setView("profile")}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-2.5 sm:px-3 py-1.5"
            aria-label="Profile"
          >
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-200 tabular-nums">{coins}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ====================== BOTTOM NAV (mobile) ======================
function BottomNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  const items: { v: View; icon: any; label: string }[] = [
    { v: "home", icon: HomeIcon, label: "Home" },
    { v: "movies", icon: Film, label: "Movies" },
    { v: "search", icon: SearchIcon, label: "Search" },
    { v: "tv", icon: Tv, label: "TV" },
    { v: "profile", icon: UserIcon, label: "Me" },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#1a1a1d]/95 backdrop-blur-md border-t border-white/[0.06] md:hidden">
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.v;
          return (
            <button
              key={it.v}
              onClick={() => setView(it.v)}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition ${active ? "text-[#e50914]" : "text-white/50"}`}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ====================== FOOTER ======================
function Footer() {
  return (
    <footer className="hidden md:block mt-16 border-t border-white/[0.06] bg-[#0a0a0c]">
      <div className="mx-auto max-w-[1400px] px-6 py-8 grid grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-[#e50914] to-[#ff4d4d] flex items-center justify-center font-extrabold text-xs">Z</div>
            <span className="font-bold">Zex<span className="text-[#e50914]">Box</span></span>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">Stream movies & TV shows free. No account needed. Watch anytime, anywhere.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-white/80">Browse</h4>
          <ul className="space-y-2 text-xs text-white/50">
            <li className="hover:text-white cursor-pointer">Home</li>
            <li className="hover:text-white cursor-pointer">Movies</li>
            <li className="hover:text-white cursor-pointer">TV Shows</li>
            <li className="hover:text-white cursor-pointer">Most Watched</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-white/80">My Account</h4>
          <ul className="space-y-2 text-xs text-white/50">
            <li className="hover:text-white cursor-pointer">Watchlist</li>
            <li className="hover:text-white cursor-pointer">History</li>
            <li className="hover:text-white cursor-pointer">Downloads</li>
            <li className="hover:text-white cursor-pointer">Profile</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-white/80">About</h4>
          <ul className="space-y-2 text-xs text-white/50">
            <li className="hover:text-white cursor-pointer">Privacy Policy</li>
            <li className="hover:text-white cursor-pointer">Terms of Service</li>
            <li className="hover:text-white cursor-pointer">Contact</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.04] py-4 text-center text-xs text-white/30">
        © 2026 Zex Box · Watch movies & TV shows free
      </div>
    </footer>
  );
}

// ====================== HOME ======================
function HomeView({ onOpen, onPlay }: { onOpen: (t: DisplayItem) => void; onPlay: (t: DisplayItem) => void; }) {
  const [banners, setBanners] = useState<any[]>([]);
  const [sections, setSections] = useState<{ title: string; type: string; items: DisplayItem[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const history = useStore((s) => s.history);
  // Use the unified home hook — pulls from MovieBox + HindiDubAnime in parallel
  const { sections: unifiedSections, loading: unifiedLoading } = useUnifiedHome();
  // Per-section "loaded more" items — keyed by section title
  const [extraItems, setExtraItems] = useState<Record<string, DisplayItem[]>>({});
  const [loadingMoreSection, setLoadingMoreSection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Call h5-api DIRECTLY from the browser — skips our server as middleman
        // This is 4-5× faster than going through /api/moviebox?action=home
        const homeRes = await fetchHomeDirect();
        if (cancelled) return;

        const sectionsRaw: { title: string; type: string; items: DisplayItem[] }[] = (homeRes.sections || [])
          .map((s: any) => ({
            title: s.title,
            type: s.type,
            items: (s.items || []).map(fromMovieBox),
          }))
          .filter((s: any) => s.items.length > 0);

        const heroPool = (homeRes.banners || []).map(fromMovieBox);

        setBanners(heroPool);
        setSections(sectionsRaw);
        setError("");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge unified sections (which include HindiDubAnime "Hindi Dub Anime" section)
  // with the MovieBox sections we fetched directly. Dedup by section title.
  const allSections = useMemo(() => {
    const merged: { title: string; type: string; items: DisplayItem[] }[] = [];
    const seen = new Set<string>();
    // MovieBox sections first
    for (const s of sections) {
      if (!seen.has(s.title)) {
        merged.push(s);
        seen.add(s.title);
      }
    }
    // Then unified sections (HindiDubAnime etc.)
    for (const s of unifiedSections) {
      if (!seen.has(s.title)) {
        merged.push({ title: s.title, type: "custom", items: s.items.map(fromUnified) });
        seen.add(s.title);
      }
    }
    return merged;
  }, [sections, unifiedSections]);

  const isLoading = loading || unifiedLoading;

  // Load more for a section — uses MovieBox trending endpoint paginated.
  // For now this only works for MovieBox sections (not HDA), since HDA browse is paginated differently.
  const handleLoadMore = useCallback(async (sectionTitle: string, sectionType: string) => {
    if (loadingMoreSection[sectionTitle]) return;
    setLoadingMoreSection(prev => ({ ...prev, [sectionTitle]: true }));
    try {
      // Heuristic: fetch page 2+ from the MovieBox trending endpoint
      // The h5-api returns more items of the same category
      const nextPage = Math.floor((extraItems[sectionTitle]?.length || 0) / 18) + 2;
      const res = await fetch(
        `https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/trending?page=${nextPage}&perPage=18`
      ).then(r => r.json()).catch(() => null);
      if (res?.data?.subjectList) {
        const newItems = res.data.subjectList.map((it: any) => fromMovieBox({
          id: it.subjectId || it.id,
          type: Number(it.subjectType) === 2 || Number(it.subjectType) === 4 ? "tv" : "movie",
          title: it.title || "Untitled",
          posterUrl: it.cover?.url,
          coverUrl: it.cover?.url,
          rating: Number(it.imdbRatingValue) || undefined,
          year: it.releaseDate ? String(it.releaseDate).slice(0, 4) : undefined,
          genres: typeof it.genre === "string" ? it.genre.split(/[,/|]/).map((g: string) => g.trim()).filter(Boolean) : [],
          country: it.countryName,
          language: it.language,
          duration: it.duration,
          durationSeconds: it.durationSeconds,
          overview: it.description,
        } as any));
        setExtraItems(prev => ({
          ...prev,
          [sectionTitle]: [...(prev[sectionTitle] || []), ...newItems],
        }));
      }
    } catch {
      // silent
    } finally {
      setLoadingMoreSection(prev => ({ ...prev, [sectionTitle]: false }));
    }
  }, [extraItems, loadingMoreSection]);

  return (
    <div>
      {/* Hero Carousel — shows skeleton while loading, no banner text */}
      <HeroCarousel items={banners} onOpen={onOpen} onPlay={onPlay} />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 space-y-8 mt-8">
        {/* Continue Watching */}
        {history.length > 0 && (
          <Row
            title="Continue Watching"
            icon={<History className="h-5 w-5 text-[#e50914]" />}
            items={history.slice(0, 10).map((h) => ({
              id: h.id, type: h.type, title: h.title, rating: 0, genres: [],
              overview: "", poster: h.poster, progress: h.progress, source: "moviebox" as const,
            }))}
            onOpen={onOpen}
            showProgress
          />
        )}

        {/* Dynamic sections from MovieBox home API + HindiDubAnime */}
        {allSections.map((s, i) => {
          const extra = extraItems[s.title] || [];
          const items = [...s.items, ...extra];
          // Show "Load More" only on MovieBox sections (trending endpoint supports pagination)
          const hasMore = s.type !== "custom" && !loading;
          return (
            <LazyRow
              key={`${s.title}-${i}`}
              title={s.title}
              items={items}
              onOpen={onOpen}
              hasMore={hasMore}
              onLoadMore={hasMore ? () => handleLoadMore(s.title, s.type) : undefined}
            />
          );
        })}

        {/* Loading skeleton rows */}
        {isLoading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {/* Fallback static catalog rows if no live data */}
        {allSections.length === 0 && !isLoading && (
          <>
            <Row title="Trending Movies" icon={<Flame className="h-5 w-5 text-orange-400" />} items={CATALOG.filter(t => t.type === "movie").slice(0, 18).map(toDisplay)} onOpen={onOpen} />
            <Row title="Trending Shows" icon={<Tv className="h-5 w-5 text-blue-400" />} items={CATALOG.filter(t => t.type === "tv").slice(0, 18).map(toDisplay)} onOpen={onOpen} />
            <Row title="Top Rated" icon={<Award className="h-5 w-5 text-yellow-400" />} items={[...CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12).map(toDisplay)} onOpen={onOpen} />
          </>
        )}
      </div>
    </div>
  );
}

// Lazy-loaded row — only renders when scrolled into view
function LazyRow({ title, items, onOpen, hasMore, onLoadMore }: {
  title: string; items: DisplayItem[]; onOpen: (t: DisplayItem) => void;
  hasMore?: boolean; onLoadMore?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <Row title={title} items={items} onOpen={onOpen} hasMore={hasMore} onLoadMore={onLoadMore} />
      ) : (
        <SkeletonRow title={title} />
      )}
    </div>
  );
}

// Skeleton placeholder row
function SkeletonRow({ title }: { title?: string }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white/40">
          {title || <span className="inline-block w-40 h-6 bg-white/10 rounded animate-pulse" />}
        </h2>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[120px] sm:w-[150px] md:w-[170px]">
            <div className="aspect-[2/3] rounded-md bg-[#1a1a1d] animate-pulse" />
            <div className="mt-1.5 h-3 bg-white/5 rounded animate-pulse" />
            <div className="mt-1 h-2 w-2/3 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ====================== HERO CAROUSEL ======================
function HeroCarousel({ items, onOpen, onPlay }: { items: DisplayItem[]; onOpen: (t: DisplayItem) => void; onPlay: (t: DisplayItem) => void; }) {
  const [idx, setIdx] = useState(0);
  const current = items[idx];

  useEffect(() => {
    if (items.length === 0) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!current) {
    // Skeleton placeholder
    return (
      <section className="relative h-[55vh] min-h-[400px] w-full bg-gradient-to-br from-[#1a1a1d] to-[#0d0d0f] flex items-center justify-center">
        <div className="text-white/30 text-sm">Loading featured content...</div>
      </section>
    );
  }

  const poster = optimizeImage(current.backdrop || current.poster, 1280);

  return (
    <section className="relative h-[65vh] min-h-[450px] max-h-[680px] w-full overflow-hidden bg-black">
      {/* Background image with fade transition */}
      <div
        key={String(current.id)}
        className="absolute inset-0 bg-cover bg-center animate-[fadeIn_0.7s_ease-out]"
        style={{ backgroundImage: `url(${poster})` }}
      />
      {/* Gradient overlays — match MovieBox style */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0f]/90 via-[#0d0d0f]/30 to-transparent" />

      {/* Content */}
      <div className="relative h-full flex items-end">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-10 sm:pb-14 w-full">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Badge className="bg-[#e50914] hover:bg-[#e50914] text-white font-semibold">
                <Sparkles className="h-3 w-3 mr-1" /> Featured
              </Badge>
              <Badge variant="outline" className="border-white/20 text-white/90 bg-black/40 backdrop-blur">
                {current.type === "tv" ? "TV Series" : "Movie"}
              </Badge>
              {current.rating ? (
                <span className="flex items-center gap-1 text-white/90 bg-black/40 backdrop-blur px-2 py-0.5 rounded">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{current.rating.toFixed(1)}</span>
                </span>
              ) : null}
              {current.year ? <span className="text-white/90 bg-black/40 backdrop-blur px-2 py-0.5 rounded">{current.year}</span> : null}
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight drop-shadow-2xl leading-[1.1]">
              {current.title}
            </h1>
            {current.overview && (
              <p className="text-sm sm:text-base text-white/85 line-clamp-3 drop-shadow-lg max-w-xl">
                {current.overview}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {current.genres.slice(0, 4).map((g) => (
                <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/10 backdrop-blur text-white/85 border border-white/10">
                  {g}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-3">
              <button
                onClick={() => onPlay(current)}
                className="inline-flex items-center gap-2 bg-white text-black hover:bg-white/90 font-semibold px-6 py-2.5 rounded-md transition shadow-lg"
              >
                <Play className="h-5 w-5 fill-black" /> Watch Now
              </button>
              <button
                onClick={() => onOpen(current)}
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 text-white hover:bg-white/25 font-medium px-6 py-2.5 rounded-md transition"
              >
                <MoreHorizontal className="h-5 w-5" /> Details
              </button>
            </div>
          </div>

          {/* Progress dots */}
          {items.length > 1 && (
            <div className="flex gap-1.5 pt-8">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1 rounded-full transition-all ${
                    i === idx ? "w-10 bg-[#e50914]" : "w-2.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ====================== ROW ======================
function Row({ title, icon, items, onOpen, showProgress, onLoadMore, hasMore }: {
  title: string; icon?: React.ReactNode; items: DisplayItem[];
  onOpen: (t: DisplayItem) => void; showProgress?: boolean;
  onLoadMore?: () => void; hasMore?: boolean;
}) {
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    // ref callback — no action needed, just keeping the ref stable
    void el;
  }, []);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  if (items.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    const el = document.querySelector(`[data-row="${title}"]`) as HTMLDivElement;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: "smooth" });
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  return (
    <section className="group/row">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight">
          {icon}
          {title}
        </h2>
        {hasMore && onLoadMore && (
          <button
            onClick={onLoadMore}
            className="text-xs text-white/50 hover:text-[#e50914] transition flex items-center gap-1 font-medium"
          >
            More <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="relative">
        {/* Left/right scroll arrows on hover (desktop) */}
        {canLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-0 bottom-0 z-20 w-12 items-center justify-center bg-gradient-to-r from-[#0d0d0f] to-transparent opacity-0 group-hover/row:opacity-100 transition"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        {canRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-0 bottom-0 z-20 w-12 items-center justify-center bg-gradient-to-l from-[#0d0d0f] to-transparent opacity-0 group-hover/row:opacity-100 transition"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        )}

        <div
          ref={scrollRef}
          data-row={title}
          onScroll={onScroll}
          className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide scroll-smooth"
        >
          {items.map((item) => (
            <MovieCard key={`${item.id}-${item.title}`} item={item} onOpen={() => onOpen(item)} showProgress={showProgress} />
          ))}
          {/* Load More card — visible at the end of each row when hasMore is true */}
          {hasMore && onLoadMore && (
            <button
              onClick={onLoadMore}
              className="shrink-0 w-[110px] sm:w-[140px] md:w-[160px] aspect-[2/3] rounded-md bg-[#1a1a1d] hover:bg-[#252528] border border-white/10 hover:border-[#e50914]/40 transition flex flex-col items-center justify-center gap-2 text-white/60 hover:text-white"
              aria-label={`Load more ${title}`}
            >
              <div className="h-10 w-10 rounded-full bg-[#e50914]/20 flex items-center justify-center">
                <ChevronRight className="h-5 w-5 text-[#e50914]" />
              </div>
              <span className="text-xs font-medium text-center px-2">Load More</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ====================== MOVIE CARD ======================
function MovieCard({ item, onOpen, showProgress }: { item: DisplayItem; onOpen: () => void; showProgress?: boolean; }) {
  // Card is 120-170px wide × 2:3 aspect = ~180-255px tall. A 240px-wide image is plenty.
  const poster = optimizeImage(item.poster, 240);
  // Tiny blur placeholder (20px wide) — loads instantly, gives visual feedback
  const blurPoster = optimizeImage(item.poster, 20);
  const [loaded, setLoaded] = useState(false);

  // Source tag config — short 2-letter badges with distinct colors
  const sourceTag = (() => {
    switch (item.source) {
      case "moviebox": return { code: "MB", color: "bg-red-600/90", title: "MovieBox" };
      case "netmirror": return { code: "NM", color: "bg-blue-600/90", title: "NetMirror" };
      case "fmovies": return { code: "FM", color: "bg-purple-600/90", title: "Fmovies" };
      case "hindidubanime": return { code: "HDA", color: "bg-orange-600/90", title: "HindiDubAnime" };
      case "catalog": return { code: "CAT", color: "bg-zinc-600/90", title: "Catalog" };
      default: return null;
    }
  })();

  return (
    <button
      onClick={onOpen}
      className="group relative shrink-0 w-[110px] sm:w-[140px] md:w-[160px] text-left"
      aria-label={`Open ${item.title}`}
    >
      <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-[#1a1a1d] ring-1 ring-white/[0.04] group-hover:ring-white/20 transition shadow-md">
        {/* Blur placeholder — loads instantly (20px wide, ~1KB) */}
        {blurPoster && (
          <img
            src={blurPoster}
            alt=""
            aria-hidden
            className={`absolute inset-0 h-full w-full object-cover blur-[10px] scale-110 transition-opacity duration-300 ${loaded ? "opacity-0" : "opacity-100"}`}
          />
        )}
        {/* Full image — fades in on load */}
        {poster ? (
          <img
            src={poster}
            alt={item.title}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`relative h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/30 text-xs p-2 text-center">{item.title}</div>
        )}
        {/* Source tag — top-left corner, short code */}
        {sourceTag && (
          <div
            className={`absolute top-1.5 left-1.5 ${sourceTag.color} backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide text-white shadow`}
            title={sourceTag.title}
          >
            {sourceTag.code}
          </div>
        )}
        {/* Rating badge */}
        {item.rating ? (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/80 backdrop-blur px-1.5 py-0.5 text-[11px]">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{item.rating.toFixed(1)}</span>
          </div>
        ) : null}
        {/* Language/region tag — bottom-left, only if known */}
        {item.language && (
          <div className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-medium text-white/90 uppercase tracking-wide">
            {item.language.split(",")[0].slice(0, 10)}
          </div>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-center p-3">
          <div className="bg-white/95 text-black rounded-full p-2.5 group-hover:scale-110 transition">
            <Play className="h-5 w-5 fill-black" />
          </div>
        </div>
        {/* Progress bar (continue watching) */}
        {showProgress && (item as any).progress !== undefined && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
            <div className="h-full bg-[#e50914]" style={{ width: `${Math.max(5, (item as any).progress)}%` }} />
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-[13px] font-medium truncate leading-tight">{item.title}</p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {item.year ? item.year : ""} {item.type === "tv" ? "· TV" : "· Movie"}
        </p>
      </div>
    </button>
  );
}

// ====================== CATEGORY VIEW (Movies / TV) ======================

// Language / region filter options — based on what MovieBox catalog provides.
// Each filter maps to a search keyword that returns relevant content from all sources.
const LANG_FILTERS = [
  { id: "all",       label: "All",          icon: Globe },
  { id: "english",   label: "English",      icon: Film },
  { id: "hindi",     label: "Hindi",        icon: Film },
  { id: "bollywood", label: "Bollywood",    icon: Film },
  { id: "punjabi",   label: "Punjabi",      icon: Film },
  { id: "tamil",     label: "Tamil",        icon: Film },
  { id: "telugu",    label: "Telugu",       icon: Film },
  { id: "korean",    label: "K-Drama",      icon: Tv },
  { id: "chinese",   label: "C-Drama",      icon: Tv },
  { id: "anime",     label: "Anime",        icon: Tv },
  { id: "nollywood", label: "Nollywood",    icon: Film },
  { id: "spanish",   label: "Spanish",      icon: Film },
];

function CategoryView({ category, onOpen }: { category: "movie" | "tv"; onOpen: (t: DisplayItem) => void; }) {
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [langFilter, setLangFilter] = useState("all");

  // When language filter changes, switch to search-based loading
  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
  }, [langFilter, category]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let newItems: DisplayItem[] = [];
        if (langFilter === "all") {
          // Default: use the list endpoint (curated catalog)
          const res = await fetch(`/api/moviebox?action=list&category=${category}&page=${page}&size=30`).then((r) => r.json());
          newItems = (res.items || []).map(fromMovieBox);
          if (cancelled) return;
          setItems(prev => page === 1 ? newItems : [...prev, ...newItems]);
          setHasMore(res.pager?.hasMore || newItems.length >= 20);
        } else {
          // Filtered by language — use search across all sources
          // For anime, also pull from HindiDubAnime source via unified search
          const searchKeyword = langFilter === "anime" && category === "tv" ? "anime" : langFilter;
          const unified = await unifiedSearch(searchKeyword, page - 1);
          newItems = unified
            .filter((u) => category === "movie" ? u.type === "movie" : u.type === "tv")
            .map(fromUnified);
          if (cancelled) return;
          // Dedupe by title+year
          const seen = new Set<string>();
          const fresh = newItems.filter((r) => {
            const key = `${r.title.toLowerCase().trim()}|${r.year || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setItems(prev => page === 1 ? fresh : [...prev, ...fresh]);
          setHasMore(fresh.length >= 8);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [category, page, langFilter]);

  const title = category === "movie" ? "Movies" : "TV Shows";

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          {category === "movie" ? <Film className="h-7 w-7 text-[#e50914]" /> : <Tv className="h-7 w-7 text-[#e50914]" />}
          {title}
        </h1>
        <span className="text-sm text-white/50">{items.length} titles</span>
      </div>

      {/* Language / region filter chips — horizontally scrollable on mobile */}
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mb-2">
          {LANG_FILTERS.map((f) => {
            const Icon = f.icon;
            const active = langFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setLangFilter(f.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition ${
                  active
                    ? "bg-[#e50914] border-[#e50914] text-white"
                    : "bg-[#1a1a1d] border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Source legend — small badges showing which sources are active */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
        <span className="text-white/40">Sources:</span>
        <span className="flex items-center gap-1"><span className="bg-red-600/90 px-1.5 py-0.5 rounded text-white font-bold">MB</span>MovieBox</span>
        <span className="flex items-center gap-1"><span className="bg-blue-600/90 px-1.5 py-0.5 rounded text-white font-bold">NM</span>NetMirror</span>
        {langFilter === "anime" && (
          <span className="flex items-center gap-1"><span className="bg-orange-600/90 px-1.5 py-0.5 rounded text-white font-bold">HDA</span>HindiDubAnime</span>
        )}
      </div>

      {loading && items.length === 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-[#1a1a1d] animate-pulse" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {items.map((item) => (
          <MovieCard key={`${item.id}-${item.title}`} item={item} onOpen={() => onOpen(item)} />
        ))}
      </div>

      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#e50914]" />
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center pt-4">
          <Button onClick={() => setPage(p => p + 1)} variant="outline" className="border-white/20 hover:bg-white/10">
            Load More
          </Button>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-white/50">
          <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">No {title.toLowerCase()} found for this filter</p>
          <p className="text-sm mt-1">Try a different language or category.</p>
        </div>
      )}
    </div>
  );
}

// ====================== SEARCH ======================
function SearchView({ onOpen }: { onOpen: (t: DisplayItem) => void; }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "moviebox" | "netmirror" | "fmovies" | "hindidubanime" | "catalog">("all");
  // Unified search — fires ALL sources in parallel, STREAMS results as each source responds.
  // No more duplicate useMovieSearch call (unified search already includes MovieBox).
  const { results: unifiedResults, loading: unifiedLoading, loadingMore, hasMore, loadMore, sourceStatus } = useUnifiedSearch(q);
  const localResults = useMemo(() => q.trim() ? searchCatalog(q).map(toDisplay) : [], [q]);

  const results = useMemo(() => {
    const unified = unifiedResults.map(fromUnified);
    const merged = [...unified, ...localResults];
    const seen = new Set<string>();
    return merged
      .filter((r) => {
        const key = `${r.title.toLowerCase().trim()}|${r.year || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((r) => filter === "all" ? true : r.type === filter)
      .filter((r) => sourceFilter === "all" ? true : r.source === sourceFilter);
  }, [unifiedResults, localResults, filter, sourceFilter]);

  const loading = unifiedLoading;

  // Source counts for the filter chips
  const sourceCounts = useMemo(() => {
    const counts = { moviebox: 0, netmirror: 0, fmovies: 0, hindidubanime: 0, catalog: 0 };
    results.forEach((r) => {
      if (counts[r.source as keyof typeof counts] !== undefined) counts[r.source as keyof typeof counts]++;
    });
    return counts;
  }, [results]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, shows, actors..."
            className="pl-12 h-14 text-base bg-[#1a1a1d] border-white/10 focus-visible:border-[#e50914] focus-visible:ring-[#e50914]/20 rounded-lg"
            autoFocus
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {loading && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-[#e50914]" />
            </div>
          )}
        </div>

        {/* Type filter tabs + source filter chips (mobile-friendly horizontal scroll) */}
        <div className="space-y-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="bg-[#1a1a1d] border border-white/10">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="movie">Movies</TabsTrigger>
              <TabsTrigger value="tv">TV Shows</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Source filter chips — only show when there are results */}
          {q && results.length > 0 && (
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <button
                  onClick={() => setSourceFilter("all")}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition ${
                    sourceFilter === "all"
                      ? "bg-white text-black border-white"
                      : "bg-[#1a1a1d] text-white/70 border-white/10 hover:bg-white/5"
                  }`}
                >
                  All Sources ({results.length})
                </button>
                {sourceCounts.moviebox > 0 && (
                  <button
                    onClick={() => setSourceFilter(sourceFilter === "moviebox" ? "all" : "moviebox")}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      sourceFilter === "moviebox"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-[#1a1a1d] text-white/70 border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <span className="bg-red-700 px-1 rounded font-bold">MB</span>
                    MovieBox ({sourceCounts.moviebox})
                  </button>
                )}
                {sourceCounts.netmirror > 0 && (
                  <button
                    onClick={() => setSourceFilter(sourceFilter === "netmirror" ? "all" : "netmirror")}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      sourceFilter === "netmirror"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-[#1a1a1d] text-white/70 border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <span className="bg-blue-700 px-1 rounded font-bold">NM</span>
                    NetMirror ({sourceCounts.netmirror})
                  </button>
                )}
                {sourceCounts.hindidubanime > 0 && (
                  <button
                    onClick={() => setSourceFilter(sourceFilter === "hindidubanime" ? "all" : "hindidubanime")}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      sourceFilter === "hindidubanime"
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-[#1a1a1d] text-white/70 border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <span className="bg-orange-700 px-1 rounded font-bold">HDA</span>
                    HindiDubAnime ({sourceCounts.hindidubanime})
                  </button>
                )}
                {sourceCounts.catalog > 0 && (
                  <button
                    onClick={() => setSourceFilter(sourceFilter === "catalog" ? "all" : "catalog")}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                      sourceFilter === "catalog"
                        ? "bg-zinc-600 text-white border-zinc-600"
                        : "bg-[#1a1a1d] text-white/70 border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <span className="bg-zinc-700 px-1 rounded font-bold">CAT</span>
                    Catalog ({sourceCounts.catalog})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live source status — shows which sources are still searching */}
          {q && loading && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
              <span>Searching:</span>
              <span className={`flex items-center gap-1 ${sourceStatus.moviebox === "done" ? "text-green-400" : sourceStatus.moviebox === "loading" ? "text-yellow-400" : "text-white/30"}`}>
                <span className="bg-red-700 px-1 rounded font-bold text-white">MB</span>
                {sourceStatus.moviebox === "done" ? "✓" : sourceStatus.moviebox === "loading" ? "…" : "·"}
              </span>
              <span className={`flex items-center gap-1 ${sourceStatus.netmirror === "done" ? "text-green-400" : sourceStatus.netmirror === "loading" ? "text-yellow-400" : "text-white/30"}`}>
                <span className="bg-blue-700 px-1 rounded font-bold text-white">NM</span>
                {sourceStatus.netmirror === "done" ? "✓" : sourceStatus.netmirror === "loading" ? "…" : "·"}
              </span>
              <span className={`flex items-center gap-1 ${sourceStatus.hindidubanime === "done" ? "text-green-400" : sourceStatus.hindidubanime === "loading" ? "text-yellow-400" : "text-white/30"}`}>
                <span className="bg-orange-700 px-1 rounded font-bold text-white">HDA</span>
                {sourceStatus.hindidubanime === "done" ? "✓" : sourceStatus.hindidubanime === "loading" ? "…" : "·"}
              </span>
            </div>
          )}
        </div>
      </div>

      {!q && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white/60">Browse by genre</h3>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setQ(g)}
                className="px-4 py-2 rounded-full text-sm bg-[#1a1a1d] hover:bg-[#e50914]/20 border border-white/10 hover:border-[#e50914]/50 transition"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {q && results.length === 0 && !loading && (
        <div className="text-center py-16 text-white/50">
          <SearchIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">No results found for "{q}"</p>
          <p className="text-sm mt-1">Try a different keyword or browse by genre.</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {results.map((t) => (
              <MovieCard key={`${t.id}-${t.title}-${t.source}`} item={t} onOpen={() => onOpen(t)} />
            ))}
          </div>

          {/* Load More button — fetches next page from all sources in parallel */}
          {hasMore && !loading && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="outline"
                className="border-white/20 hover:bg-white/10 min-w-[180px]"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  <>Load More Results</>
                )}
              </Button>
            </div>
          )}

          {!hasMore && results.length > 8 && (
            <div className="text-center text-xs text-white/40 py-4">
              End of results — {results.length} titles from all sources
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ====================== DETAIL ======================
function DetailView({ item, initialEpisode, onPlay, onBack, onOpen }: {
  item: DisplayItem; initialEpisode?: string; onPlay: (episode?: string) => void; onBack: () => void; onOpen: (t: DisplayItem) => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [downloadSeason, setDownloadSeason] = useState(1);
  const [downloadEpisode, setDownloadEpisode] = useState(1);
  const watchlist = useStore((s) => s.watchlist);
  const toggleWatchlist = useStore((s) => s.toggleWatchlist);
  const startDownload = useStore((s) => s.startDownload);
  const coins = useStore((s) => s.coins);
  const inList = !!watchlist.find((w) => String(w.id) === String(item.id));

  const liveId = item.source === "moviebox" ? String(item.id) : null;
  const { detail: liveDetail, recs: liveRecs, seasons: liveSeasons, loading: detailLoading } = useDetail(liveId);

  const mergedItem: DisplayItem = useMemo(() => {
    if (!liveDetail) return item;
    const d = liveDetail;
    return {
      ...item,
      title: d.title || item.title,
      overview: d.description || d.intro || d.synopsis || item.overview,
      runtime: d.durationSeconds ? Math.round(d.durationSeconds / 60) : item.runtime,
      genres: d.genre ? d.genre.split(/[,/|]/).map((g: string) => g.trim()).filter(Boolean) : item.genres,
      cast: d.staffList?.map((s: any) => s.name).filter(Boolean) || item.cast,
      director: d.staffList?.find((s: any) => s.role === "Director")?.name || item.director,
      seasons: liveSeasons?.seasons?.length || d.seNum || item.seasons,
      rating: d.imdbRatingValue ? Number(d.imdbRatingValue) : item.rating,
      ratingCount: d.imdbRatingCount || d.ratingCount,
      country: d.countryName || item.country,
    };
  }, [item, liveDetail, liveSeasons]);

  // Build episode list from real season info
  const episodes = useMemo(() => {
    if (mergedItem.type !== "tv") return [];
    // If we have live season info, use the actual maxEp for the selected season
    if (liveSeasons?.seasons?.length > 0) {
      const seasonInfo = liveSeasons.seasons.find((s: any) => s.se === selectedSeason) || liveSeasons.seasons[0];
      const maxEp = seasonInfo?.maxEp || 10;
      return Array.from({ length: Math.min(maxEp, 50) }, (_, i) => i + 1);
    }
    // Fallback: show 10 episodes
    const count = Math.min(mergedItem.episodes || 10, 24);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [mergedItem, liveSeasons, selectedSeason]);

  const recommendations = useMemo(() => {
    const live = liveRecs.map(fromMovieBox);
    if (live.length > 0) return live;
    return CATALOG.filter((t) => t.id !== item.id && t.genres.some((g) => item.genres.includes(g))).slice(0, 12).map(toDisplay);
  }, [liveRecs, item]);

  const qualityOptions = [
    { label: "360p", cost: 5, res: 360 },
    { label: "480p", cost: 10, res: 480 },
    { label: "720p", cost: 20, res: 720 },
    { label: "1080p", cost: 40, res: 1080 },
  ];

  const handleDownload = async (q: typeof qualityOptions[number]) => {
    // First, fetch the real stream URL from MovieBox
    let streamUrl: string | undefined;
    let actualSizeMB = q.res >= 720 ? 1500 : q.res >= 480 ? 700 : 350;

    try {
      // Build the play URL with se/ep for TV — use downloadSeason/downloadEpisode
      let playUrl = `/api/moviebox?action=play&subjectId=${item.id}`;
      if (item.type === "tv") {
        playUrl += `&se=${downloadSeason}&ep=${downloadEpisode}`;
      }

      const playRes = await fetch(playUrl).then((r) => r.json());
      const allStreams = [
        ...(playRes.streams || []),
        ...(playRes.hls || []),
        ...(playRes.dash || []),
      ];

      if (allStreams.length === 0) {
        toast.error("No streams available", { description: "This title can't be downloaded right now." });
        return;
      }

      // Find the stream matching the requested resolution (or closest lower)
      const matching = allStreams
        .filter((s: any) => Number(s.resolutions || s.resolution || 0) <= q.res)
        .sort((a: any, b: any) => Number(b.resolutions || b.resolution) - Number(a.resolutions || a.resolution));

      const stream = matching[0] || allStreams[0];
      streamUrl = stream.url;
      actualSizeMB = stream.size ? Math.round(Number(stream.size) / (1024 * 1024)) : actualSizeMB;
    } catch {
      toast.error("Failed to get stream URL", { description: "Please try again." });
      return;
    }

    const ok = startDownload({
      id: String(item.id),
      type: item.type, title: item.title, poster: item.poster || "",
      quality: q.label, sizeMB: actualSizeMB, cost: q.cost,
      streamUrl,
    });
    if (ok) {
      toast.success(`Download started: ${item.title}${item.type === "tv" ? ` S${downloadSeason}E${downloadEpisode}` : ""} (${q.label})`, {
        description: `-${q.cost} coins · ${actualSizeMB >= 1000 ? (actualSizeMB / 1000).toFixed(1) + " GB" : actualSizeMB + " MB"}`,
      });
    } else {
      toast.error("Not enough coins", { description: `You need ${q.cost} coins to download ${q.label}.` });
    }
  };

  const backdropUrl = optimizeImage(mergedItem.backdrop || mergedItem.poster, 1280);
  const posterUrl = optimizeImage(mergedItem.poster, 400);

  return (
    <div>
      {/* Hero backdrop */}
      <section className="relative h-[45vh] min-h-[320px] max-h-[540px] w-full">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backdropUrl})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0f]/80 to-transparent" />
        <div className="absolute top-4 left-4 z-10">
          <button onClick={onBack} className="bg-black/50 hover:bg-black/70 backdrop-blur text-white rounded-full p-2 transition" aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        {detailLoading && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
          </div>
        )}
      </section>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 -mt-32 relative">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="shrink-0 mx-auto md:mx-0">
            <div className="w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10">
              {posterUrl && <img src={posterUrl} alt={mergedItem.title} className="h-full w-full object-cover" />}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <Badge className="bg-[#e50914] hover:bg-[#e50914]">
                  {mergedItem.type === "tv" ? "TV Series" : "Movie"}
                </Badge>
                {mergedItem.rating ? (
                  <span className="flex items-center gap-1 text-white/90">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{mergedItem.rating.toFixed(1)}</span>
                    {mergedItem.ratingCount ? <span className="text-white/40 ml-1">({mergedItem.ratingCount.toLocaleString()})</span> : null}
                  </span>
                ) : null}
                {mergedItem.year ? <span className="text-white/80 flex items-center gap-1"><Calendar className="h-3 w-3" /> {mergedItem.year}</span> : null}
                {mergedItem.runtime ? <span className="text-white/80 flex items-center gap-1"><Clock className="h-3 w-3" /> {mergedItem.runtime}m</span> : null}
                {mergedItem.country ? <span className="text-white/60">{mergedItem.country}</span> : null}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight drop-shadow-lg">{mergedItem.title}</h1>
              <div className="flex flex-wrap gap-1.5">
                {mergedItem.genres.map((g) => (
                  <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/80 border border-white/10">{g}</span>
                ))}
              </div>
            </div>

            {/* Action buttons — match MovieBox "Watch Online" / "Trailer" / "Watch in App" */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => onPlay(mergedItem.type === "tv" ? `S${selectedSeason}E1` : undefined)}
                className="inline-flex items-center gap-2 bg-[#e50914] hover:bg-[#f6121d] text-white font-semibold px-6 py-3 rounded-md transition shadow-lg shadow-red-600/30"
              >
                <Play className="h-5 w-5 fill-white" /> Watch Online
              </button>
              <button
                onClick={() => toast.info("Trailer coming soon")}
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white font-medium px-6 py-3 rounded-md transition"
              >
                <Play className="h-4 w-4" /> Trailer
              </button>
              <button
                onClick={() => toggleWatchlist({
                  id: String(item.id),
                  type: item.type, title: item.title, poster: item.poster || "",
                })}
                className={`inline-flex items-center gap-2 backdrop-blur border font-medium px-6 py-3 rounded-md transition ${
                  inList ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10"
                }`}
              >
                {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {inList ? "Added" : "Watchlist"}
              </button>
            </div>

            {mergedItem.overview && (
              <p className="text-sm sm:text-base text-white/80 leading-relaxed pt-2">{mergedItem.overview}</p>
            )}

            {mergedItem.director && (
              <p className="text-sm text-white/60"><span className="text-white/40">Director: </span>{mergedItem.director}</p>
            )}
            {mergedItem.cast && mergedItem.cast.length > 0 && (
              <p className="text-sm text-white/60"><span className="text-white/40">Cast: </span>{mergedItem.cast.slice(0, 8).join(", ")}</p>
            )}
            {mergedItem.type === "tv" && mergedItem.seasons && (
              <p className="text-sm text-white/60"><span className="text-white/40">Seasons: </span>{mergedItem.seasons}</p>
            )}
          </div>
        </div>

        {/* TV Episodes */}
        {mergedItem.type === "tv" && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-bold">Episodes</h2>
              {/* Season tabs — like movie-box.co (S01, S02, etc.) */}
              {liveSeasons?.seasons?.length > 1 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {liveSeasons.seasons.map((s: any) => (
                    <button
                      key={s.se}
                      onClick={() => setSelectedSeason(s.se)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                        selectedSeason === s.se
                          ? "bg-[#e50914] text-white"
                          : "bg-[#1a1a1d] text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      S{String(s.se).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              ) : detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading seasons...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/50">Season</span>
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="bg-[#1a1a1d] border border-white/20 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#e50914]"
                  >
                    {Array.from({ length: mergedItem.seasons || 1 }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s} className="bg-[#0d0d0f]">{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {episodes.map((ep) => {
                const epCode = `S${selectedSeason}E${ep}`;
                const isActive = initialEpisode === epCode;
                return (
                  <button
                    key={ep}
                    onClick={() => onPlay(epCode)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                      isActive ? "border-[#e50914] bg-[#e50914]/10" : "border-white/10 bg-[#1a1a1d] hover:border-white/30 hover:bg-white/5"
                    }`}
                  >
                    <div className="shrink-0 h-10 w-10 rounded-md bg-gradient-to-br from-[#e50914]/30 to-[#ff4d4d]/20 flex items-center justify-center font-bold">
                      {ep}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">Episode {ep}</p>
                      <p className="text-xs text-white/40 truncate">{epCode} · {mergedItem.runtime || 45}m</p>
                    </div>
                    <Play className="h-5 w-5 text-white/70 shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Download options */}
        <section className="mt-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DownloadIcon className="h-5 w-5 text-[#e50914]" /> Download
          </h2>

          {/* Episode selector for TV shows */}
          {mergedItem.type === "tv" && (
            <div className="mb-4 p-4 rounded-lg bg-[#1a1a1d] border border-white/10">
              <p className="text-sm text-white/60 mb-3">Select episode to download:</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-white/50">Season</span>
                {liveSeasons?.seasons?.length > 0 ? (
                  <select
                    value={downloadSeason}
                    onChange={(e) => setDownloadSeason(Number(e.target.value))}
                    className="bg-[#0d0d0f] border border-white/20 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#e50914]"
                  >
                    {liveSeasons.seasons.map((s: any) => (
                      <option key={s.se} value={s.se} className="bg-[#0d0d0f]">
                        Season {s.se} ({s.maxEp} eps)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-white/40">Loading...</span>
                )}
                <span className="text-sm text-white/50">Episode</span>
                <select
                  value={downloadEpisode}
                  onChange={(e) => setDownloadEpisode(Number(e.target.value))}
                  className="bg-[#0d0d0f] border border-white/20 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[#e50914]"
                >
                  {episodes.map((ep) => (
                    <option key={ep} value={ep} className="bg-[#0d0d0f]">Episode {ep}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-white/40">
                Downloading: S{downloadSeason}E{downloadEpisode}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {qualityOptions.map((q) => {
              const affordable = coins >= q.cost;
              return (
                <button
                  key={q.label}
                  onClick={() => handleDownload(q)}
                  disabled={!affordable}
                  className={`p-4 rounded-lg border text-left transition ${
                    affordable ? "border-white/10 bg-[#1a1a1d] hover:border-[#e50914] hover:bg-[#e50914]/5" : "border-white/[0.04] bg-[#1a1a1d]/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{q.label}</span>
                    <span className="flex items-center gap-1 text-amber-400 text-sm">
                      <Coins className="h-3.5 w-3.5" /> {q.cost}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    ~{q.res >= 720 ? "1.5 GB" : q.res >= 480 ? "700 MB" : "350 MB"}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* More like this */}
        {recommendations.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold mb-4">More Like This</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {recommendations.map((r) => (
                <MovieCard key={`${r.id}-${r.title}`} item={r} onOpen={() => onOpen(r)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ====================== DOWNLOADS ======================
function DownloadsView() {
  const downloads = useStore((s) => s.downloads);
  const removeDownload = useStore((s) => s.removeDownload);
  const clearDownloads = useStore((s) => s.clearDownloads);
  const active = downloads.filter((d) => d.status !== "complete");
  const completed = downloads.filter((d) => d.status === "complete");

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <DownloadIcon className="h-7 w-7 text-[#e50914]" /> Downloads
        </h1>
        {downloads.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearDownloads} className="text-white/60 hover:text-red-400">
            <Trash2 className="h-4 w-4 mr-1" /> Clear all
          </Button>
        )}
      </div>

      {downloads.length === 0 && (
        <div className="text-center py-20 text-white/50">
          <DownloadIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">No downloads yet</p>
          <p className="text-sm mt-1">Browse movies & shows, then tap Download.</p>
        </div>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Active Downloads</h2>
          <div className="space-y-2">
            {active.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1d] border border-white/10">
                <div className="shrink-0 h-14 w-10 rounded overflow-hidden bg-[#252528]">
                  {d.poster && <img src={optimizeImage(d.poster, 100)} alt={d.title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.title}</p>
                  <p className="text-xs text-white/50">
                    {d.quality} · {d.sizeMB >= 1000 ? (d.sizeMB / 1000).toFixed(1) + " GB" : d.sizeMB + " MB"}
                    {d.downloadSpeed && d.status === "downloading" && (
                      <span className="text-green-400 ml-2">· {d.downloadSpeed}</span>
                    )}
                    {d.status === "failed" && <span className="text-red-400 ml-2">· Failed</span>}
                  </p>
                  <Progress value={d.progress} className="h-1.5 mt-1.5" />
                  <p className="text-[10px] text-white/40 mt-0.5">{Math.round(d.progress)}%</p>
                </div>
                <button onClick={() => removeDownload(d.id)} className="shrink-0 p-2 text-white/40 hover:text-red-400 transition" aria-label="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Downloaded — Ready to Watch Offline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completed.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1d] border border-white/10">
                <div className="shrink-0 h-16 w-11 rounded overflow-hidden bg-[#252528]">
                  {d.poster && <img src={optimizeImage(d.poster, 100)} alt={d.title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.title}</p>
                  <p className="text-xs text-white/50">{d.quality} · {d.sizeMB >= 1000 ? (d.sizeMB / 1000).toFixed(1) + " GB" : d.sizeMB + " MB"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-green-600/20 text-green-300 border border-green-500/30 text-xs">Saved to device</Badge>
                    {d.blobUrl && (
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = d.blobUrl!;
                          a.download = `${d.title} (${d.quality}).mp4`;
                          a.click();
                        }}
                        className="text-xs text-[#e50914] hover:underline"
                      >
                        Re-download
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => removeDownload(d.id)} className="shrink-0 p-2 text-white/40 hover:text-red-400" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ====================== WATCHLIST ======================
function WatchlistView({ onOpen }: { onOpen: (t: DisplayItem) => void; }) {
  const watchlist = useStore((s) => s.watchlist);
  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
        <Bookmark className="h-7 w-7 text-[#e50914]" /> My Watchlist
      </h1>
      {watchlist.length === 0 ? (
        <div className="text-center py-20 text-white/50">
          <Bookmark className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">Your watchlist is empty</p>
          <p className="text-sm mt-1">Tap the + button on any title to save it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {watchlist.map((w) => (
            <MovieCard
              key={w.id}
              item={{
                id: w.id, type: w.type, title: w.title, rating: 0, genres: [],
                overview: "", poster: w.poster, source: typeof w.id === "string" && w.id.length > 5 ? "moviebox" : "catalog",
              }}
              onOpen={() => {
                const t = CATALOG.find((c) => String(c.id) === String(w.id));
                if (t) onOpen(toDisplay(t));
                else {
                  // MovieBox item — open with source: "moviebox"
                  onOpen({
                    id: w.id, type: w.type, title: w.title, rating: 0, genres: [],
                    overview: "", poster: w.poster, source: "moviebox",
                  });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ====================== HISTORY ======================
function HistoryView({ onOpen, onPlay }: { onOpen: (t: DisplayItem) => void; onPlay: (t: DisplayItem, ep?: string) => void; }) {
  const history = useStore((s) => s.history);
  const clearHistory = useStore((s) => s.clearHistory);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <History className="h-7 w-7 text-[#e50914]" /> Watch History
        </h1>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory} className="text-white/60 hover:text-red-400">
            <Trash2 className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="text-center py-20 text-white/50">
          <History className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">No watch history yet</p>
          <p className="text-sm mt-1">Titles you watch will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((h) => {
            // Check if this is a MovieBox item (ID is a long string, not a small number)
            const isMovieBox = typeof h.id === "string" && h.id.length > 5;
            const t = CATALOG.find((c) => String(c.id) === String(h.id));
            const item: DisplayItem = t ? toDisplay(t) : {
              id: h.id, type: h.type, title: h.title, rating: 0, genres: [],
              overview: "", poster: h.poster, source: isMovieBox ? "moviebox" : "catalog",
            };
            return (
              <div key={`${h.id}-${h.watchedAt}`} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1d] border border-white/10 hover:bg-white/5 transition">
                <button onClick={() => onOpen(item)} className="shrink-0 h-16 w-11 rounded overflow-hidden bg-[#252528]">
                  {h.poster && <img src={optimizeImage(h.poster, 100)} alt={h.title} className="h-full w-full object-cover" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{h.title}</p>
                  <p className="text-xs text-white/50">{h.episode ? `${h.episode} · ` : ""}Watched {timeAgo(h.watchedAt)}</p>
                  {h.progress > 0 && h.progress < 100 && (
                    <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#e50914]" style={{ width: `${h.progress}%` }} />
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => onPlay(item, h.episode)} className="text-[#e50914] hover:text-[#f6121d] hover:bg-[#e50914]/10">
                  <Play className="h-4 w-4 mr-1" /> Resume
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ====================== PROFILE ======================
function ProfileView({ setView }: { setView: (v: View) => void; }) {
  const coins = useStore((s) => s.coins);
  const lastDailyCheckIn = useStore((s) => s.lastDailyCheckIn);
  const dailyCheckIn = useStore((s) => s.dailyCheckIn);
  const watchAdForCoins = useStore((s) => s.watchAdForCoins);
  const history = useStore((s) => s.history);
  const watchlist = useStore((s) => s.watchlist);
  const downloads = useStore((s) => s.downloads);
  const [checkingIn, setCheckingIn] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [identity, setIdentity] = useState<any>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("AUTO");
  const [resetting, setResetting] = useState(false);
  const [changingRegion, setChangingRegion] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [whoami, regionsRes] = await Promise.all([
          fetch("/api/moviebox?action=whoami").then((r) => r.json()),
          fetch("/api/moviebox?action=regions").then((r) => r.json()),
        ]);
        setIdentity(whoami);
        setRegions(regionsRes.regions || []);
        setSelectedRegion(whoami.region || "AUTO");
      } catch {}
    })();
  }, []);

  const refreshIdentity = async () => {
    const whoami = await fetch("/api/moviebox?action=whoami").then((r) => r.json());
    setIdentity(whoami);
    setSelectedRegion(whoami.region || "AUTO");
  };

  const handleRegionChange = async (region: string) => {
    setChangingRegion(true);
    try {
      await fetch("/api/moviebox?action=set-region", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region }),
      });
      setSelectedRegion(region);
      toast.success("Region changed", {
        description: region === "AUTO"
          ? "Now using your real IP"
          : `Now using ${regions.find((r) => r.code === region)?.name || region}`,
      });
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Failed to change region");
    } finally {
      setChangingRegion(false);
    }
  };

  const handleResetIdentity = async () => {
    setResetting(true);
    try {
      await fetch("/api/moviebox?action=reset-identity", { method: "POST" });
      toast.success("Identity reset", { description: "You now have a new visitor account on MovieBox." });
      await refreshIdentity();
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Failed to reset identity");
    } finally {
      setResetting(false);
    }
  };

  const canCheckIn = Date.now() - lastDailyCheckIn >= 24 * 60 * 60 * 1000;
  const handleCheckIn = () => {
    setCheckingIn(true);
    setTimeout(() => {
      const ok = dailyCheckIn();
      if (ok) toast.success("Daily check-in complete!", { description: "+10 coins added to your balance." });
      else toast.error("Already checked in today", { description: "Come back tomorrow for more coins." });
      setCheckingIn(false);
    }, 800);
  };
  const handleWatchAd = () => {
    setWatchingAd(true);
    setTimeout(() => {
      watchAdForCoins();
      toast.success("Ad watched!", { description: "+15 coins added to your balance." });
      setWatchingAd(false);
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-[#e50914]/20 to-[#ff4d4d]/10 border border-[#e50914]/30">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#e50914] to-[#ff4d4d] flex items-center justify-center text-2xl font-bold shadow-lg shadow-red-600/30">Z</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">Zex Box User</h1>
          <p className="text-sm text-white/60 truncate">
            {identity?.visitorUserId
              ? `Visitor #${String(identity.visitorUserId).slice(-8)} · ${identity.regionInfo?.name || "Auto"}`
              : "Guest · Browse & watch free"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-amber-400 font-bold text-xl">
            <Coins className="h-5 w-5" /> {coins}
          </div>
          <p className="text-xs text-white/50">coins</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setView("history")} className="p-4 rounded-xl bg-[#1a1a1d] border border-white/10 hover:border-[#e50914] transition text-left">
          <History className="h-5 w-5 text-[#e50914] mb-2" />
          <p className="text-2xl font-bold">{history.length}</p>
          <p className="text-xs text-white/50">Watched</p>
        </button>
        <button onClick={() => setView("watchlist")} className="p-4 rounded-xl bg-[#1a1a1d] border border-white/10 hover:border-[#e50914] transition text-left">
          <Bookmark className="h-5 w-5 text-[#e50914] mb-2" />
          <p className="text-2xl font-bold">{watchlist.length}</p>
          <p className="text-xs text-white/50">Watchlist</p>
        </button>
        <button onClick={() => setView("downloads")} className="p-4 rounded-xl bg-[#1a1a1d] border border-white/10 hover:border-[#e50914] transition text-left">
          <DownloadIcon className="h-5 w-5 text-[#e50914] mb-2" />
          <p className="text-2xl font-bold">{downloads.length}</p>
          <p className="text-xs text-white/50">Downloads</p>
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Globe className="h-5 w-5 text-[#e50914]" /> Identity & Region
        </h2>

        <div className="p-4 rounded-xl bg-[#1a1a1d] border border-white/10">
          <div className="mb-2">
            <p className="font-medium text-sm">IP / Region</p>
            <p className="text-xs text-white/50">
              By default we use <span className="text-green-300">your real IP</span> (works worldwide).
              Pick a country only if you want to override.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {regions.map((r) => (
              <button
                key={r.code}
                onClick={() => handleRegionChange(r.code)}
                disabled={changingRegion || r.code === selectedRegion}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  r.code === selectedRegion ? "bg-[#e50914] border-[#e50914] text-white" : "bg-[#0d0d0f] border-white/10 text-white/70 hover:border-[#e50914]/50"
                } disabled:opacity-50`}
              >
                {r.name}
              </button>
            ))}
          </div>
          {changingRegion && <p className="text-xs text-[#e50914] mt-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Changing...</p>}
        </div>

        <div className="p-4 rounded-xl bg-[#1a1a1d] border border-white/10">
          <p className="font-medium text-sm mb-3">Your Visitor Identity</p>
          {identity ? (
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between gap-2"><span className="text-white/40">User ID:</span><span className="text-green-300 truncate">{identity.visitorUserId || "(visit a title first)"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-white/40">Device ID:</span><span className="text-white/70 truncate">{identity.device?.device_id}</span></div>
              <div className="flex justify-between gap-2"><span className="text-white/40">MAC:</span><span className="text-white/70 truncate">{identity.device?.mac}</span></div>
              <div className="flex justify-between gap-2"><span className="text-white/40">IMEI:</span><span className="text-white/70 truncate">{identity.device?.imei}</span></div>
              <div className="flex justify-between gap-2 pt-1.5 border-t border-white/10 mt-1.5"><span className="text-white/40">Your real IP:</span><span className="text-blue-300 truncate">{identity.realIp}</span></div>
              <div className="flex justify-between gap-2"><span className="text-white/40">Sent to MovieBox:</span><span className={`truncate ${identity.usingRealIp ? "text-green-300" : "text-amber-300"}`}>{identity.effectiveIp}{identity.usingRealIp && " ✓"}</span></div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-white/40"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          )}
          <button onClick={handleResetIdentity} disabled={resetting} className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-300 hover:bg-red-500/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Reset Identity
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Gift className="h-5 w-5 text-amber-400" /> Earn Coins
        </h2>
        <button onClick={handleCheckIn} disabled={!canCheckIn || checkingIn} className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1a1a1d] border border-white/10 hover:border-amber-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed text-left">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500/30 to-yellow-500/30 flex items-center justify-center">
            <Gift className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Daily Check-in</p>
            <p className="text-xs text-white/50">{canCheckIn ? "Claim 10 coins" : `Come back in ${timeUntilTomorrow(lastDailyCheckIn)}`}</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30">+10</Badge>
        </button>
        <button onClick={handleWatchAd} disabled={watchingAd} className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#1a1a1d] border border-white/10 hover:border-amber-500/50 transition disabled:opacity-50 text-left">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#e50914]/30 to-[#ff4d4d]/30 flex items-center justify-center">
            {watchingAd ? <div className="h-5 w-5 border-2 border-[#e50914] border-t-transparent rounded-full animate-spin" /> : <Play className="h-5 w-5 text-[#e50914]" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">Watch Ad</p>
            <p className="text-xs text-white/50">{watchingAd ? "Playing ad..." : "Watch a short ad for coins"}</p>
          </div>
          <Badge className="bg-[#e50914]/20 text-[#ff6b6b] border border-[#e50914]/30">+15</Badge>
        </button>
      </section>

      <div className="text-center text-xs text-white/40 pt-4">Zex Box · v2.1</div>
    </div>
  );
}

// ====================== UTILS ======================
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "just now";
}

function timeUntilTomorrow(lastTs: number): string {
  const next = lastTs + 24 * 60 * 60 * 1000;
  const diff = next - Date.now();
  const hr = Math.floor(diff / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  return `${hr}h ${min}m`;
}
