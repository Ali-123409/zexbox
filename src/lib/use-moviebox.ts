"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MovieItem } from "@/lib/h5api";
import { searchDirect, fetchDetailDirect, fetchRecsDirect, fetchPlayDirect, fetchSeasonsDirect } from "@/lib/h5api";

interface ApiResponse<T> {
  items?: MovieItem[];
  pager?: { hasMore?: boolean; nextPage?: string };
  detail?: any;
  sources?: any[];
  raw?: any;
  error?: string;
}

// Hook: debounced search — uses h5-api DIRECTLY (no proxy, with visitor token)
// Properly handles race conditions with a ref-based request ID.
export function useMovieSearch(keyword: string, delay = 400) {
  const [results, setResults] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const myRequestId = ++latestRequestRef.current;

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await searchDirect(trimmed);
        if (myRequestId !== latestRequestRef.current) return;
        setResults(items);
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
    };
  }, [keyword, delay]);

  return { results, loading };
}

// Hook: fetch detail + recs directly via h5-api
export function useDetail(id: string | null) {
  const [detail, setDetail] = useState<any>(null);
  const [recs, setRecs] = useState<MovieItem[]>([]);
  const [seasons, setSeasons] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      setRecs([]);
      setSeasons(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [d, r, s] = await Promise.all([
          fetchDetailDirect(id),
          fetchRecsDirect(id),
          fetchSeasonsDirect(id),
        ]);
        if (cancelled) return;
        setDetail(d);
        setRecs(r);
        setSeasons(s);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setRecs([]);
          setSeasons(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { detail, recs, seasons, loading };
}

// Hook: fetch play streams directly via h5-api
// For TV shows, pass se (season) + ep (episode number)
export function usePlayStreams(subjectId: string | null, se?: number, ep?: number) {
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
        const result = await fetchPlayDirect(subjectId, se, ep);
        if (cancelled) return;
        // Combine streams + hls + dash into one array
        const all = [
          ...(result.streams || []),
          ...(result.hls || []),
          ...(result.dash || []),
        ];
        setStreams(all);
      } catch {
        if (!cancelled) setStreams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, se, ep]);

  return { streams, loading };
}
