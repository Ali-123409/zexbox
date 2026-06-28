"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MovieItem } from "@/lib/moviebox";

interface ApiResponse<T> {
  items?: MovieItem[];
  pager?: { hasMore?: boolean; nextPage?: string };
  detail?: any;
  sources?: any[];
  raw?: any;
  error?: string;
}

async function api<T = any>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL("/api/moviebox", window.location.origin);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${action} failed: ${res.status}`);
  return res.json();
}

// Hook: fetch hot + lists + trending for home view
export function useHomeData() {
  const [hot, setHot] = useState<MovieItem[]>([]);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [tv, setTv] = useState<MovieItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<MovieItem[]>([]);
  const [trendingShows, setTrendingShows] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [hotRes, movieRes, tvRes, trendMovieRes, trendTvRes] = await Promise.all([
          api<ApiResponse>("hot").catch(() => ({ items: [] })),
          api<ApiResponse>("list", { category: "movie", size: "20" }).catch(() => ({ items: [] })),
          api<ApiResponse>("list", { category: "tv", size: "20" }).catch(() => ({ items: [] })),
          api<ApiResponse>("trending", { category: "movie", size: "20" }).catch(() => ({ items: [] })),
          api<ApiResponse>("trending", { category: "tv", size: "20" }).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setHot(hotRes.items || []);
        setMovies(movieRes.items || []);
        setTv(tvRes.items || []);
        setTrendingMovies(trendMovieRes.items || []);
        setTrendingShows(trendTvRes.items || []);
        setError("");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { hot, movies, tv, trendingMovies, trendingShows, loading, error };
}

// Hook: debounced search — uses LIVE /subject-api/search/v2 (with guest JWT)
// Properly handles race conditions with a ref-based request ID.
export function useMovieSearch(keyword: string, delay = 400) {
  const [results, setResults] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Ref to track the latest request — survives re-renders
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Increment request ID — only the latest one will update state
    const myRequestId = ++latestRequestRef.current;

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/moviebox?action=search&keyword=${encodeURIComponent(trimmed)}`
        ).then((r) => r.json()).catch(() => ({ items: [] }));

        // Only update if this is still the latest request
        if (myRequestId !== latestRequestRef.current) return;
        setResults(res.items || []);
      } catch {
        if (myRequestId !== latestRequestRef.current) return;
        setResults([]);
      } finally {
        if (myRequestId !== latestRequestRef.current) return;
        setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(t);
      // Don't reset latestRequestRef here — that would let stale requests through
    };
  }, [keyword, delay]);

  return { results, loading };
}

// Hook: fetch detail + recs
export function useDetail(id: string | null) {
  const [detail, setDetail] = useState<any>(null);
  const [recs, setRecs] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      setRecs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [dRes, rRes] = await Promise.all([
          api<ApiResponse>("detail", { id }).catch(() => ({ detail: null })),
          api<ApiResponse>("recs", { id }).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        setDetail(dRes.detail);
        setRecs(rRes.items || []);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setRecs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { detail, recs, loading };
}

// Hook: fetch play streams (returns real MP4/HLS URLs from MovieBox CDN)
export function usePlayStreams(subjectId: string | null) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subjectId) {
      setStreams([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/moviebox?action=play&subjectId=${encodeURIComponent(subjectId)}`).then((r) => r.json());
        if (cancelled) return;
        setStreams(res.streams || []);
      } catch {
        if (!cancelled) setStreams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  return { streams, loading };
}
