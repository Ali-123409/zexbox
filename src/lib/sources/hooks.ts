/**
 * React hooks for unified multi-source search & resolve.
 * These call into src/lib/sources/index.ts which fires all sources in parallel.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { unifiedSearch, getUnifiedHome, unifiedResolve } from "./index";
import type { UnifiedItem } from "./types";

/** Unified search — fires all sources in parallel, returns deduped merged results.
 *  Supports Load More via the loadMore() callback — fetches the next page from
 *  every source and appends to the existing results. */
export function useUnifiedSearch(keyword: string) {
  const [results, setResults] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const keywordRef = useRef(keyword);

  // Reset pagination when keyword changes
  useEffect(() => {
    if (keywordRef.current !== keyword) {
      keywordRef.current = keyword;
      pageRef.current = 0;
      setHasMore(true);
      setResults([]);
    }
  }, [keyword]);

  useEffect(() => {
    const q = keyword.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setHasMore(true);
      pageRef.current = 0;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    pageRef.current = 0;

    const t = setTimeout(async () => {
      try {
        const r = await unifiedSearch(q, 0);
        if (!cancelled) {
          setResults(r);
          setError("");
          // If we got a healthy batch, assume more might be available
          setHasMore(r.length >= 10);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300); // debounce 300ms

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [keyword]);

  const loadMore = useCallback(async () => {
    const q = keyword.trim();
    if (!q || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const more = await unifiedSearch(q, nextPage);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        // Dedupe against existing results
        setResults((prev) => {
          const seen = new Set(prev.map((r) => `${r.title.toLowerCase().trim()}|${r.year || ""}`));
          const fresh = more.filter((r) => !seen.has(`${r.title.toLowerCase().trim()}|${r.year || ""}`));
          pageRef.current = nextPage;
          if (fresh.length < more.length * 0.3) setHasMore(false); // mostly dupes — stop
          return [...prev, ...fresh];
        });
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [keyword, loadingMore, hasMore]);

  return { results, loading, loadingMore, error, hasMore, loadMore };
}

/** Unified home — sections from all browsable sources. */
export function useUnifiedHome() {
  const [sections, setSections] = useState<{ title: string; items: UnifiedItem[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await getUnifiedHome();
        if (!cancelled) {
          setSections(r.sections);
          setError("");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load home");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sections, loading, error };
}

/** Resolve an item to playable stream/embed URL. */
export function useUnifiedResolve() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resolve = useCallback(
    async (item: UnifiedItem, season?: number, episode?: number) => {
      setLoading(true);
      setError("");
      try {
        const r = await unifiedResolve(item, season, episode);
        setLoading(false);
        return r;
      } catch (e: any) {
        setError(e?.message || "Failed to resolve stream");
        setLoading(false);
        return {};
      }
    },
    []
  );

  return { resolve, loading, error };
}
