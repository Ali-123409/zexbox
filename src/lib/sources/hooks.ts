/**
 * React hooks for unified multi-source search & resolve.
 *
 * KEY DESIGN DECISION: Results stream in per-source, NOT via Promise.all.
 * This means NetMirror results (41ms) appear instantly, MovieBox results (~2s)
 * appear next, and HindiDubAnime results (~10s timeout) appear last.
 * The user sees results immediately instead of waiting 10s for all sources.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { unifiedResolve, SOURCES } from "./index";
import { safeAll, dedupeItems } from "./types";
import { getUnifiedHome } from "./index";
import type { UnifiedItem, SourceId } from "./types";

/** Unified search — fires all sources in parallel, STREAMS results as they arrive.
 *  Supports Load More via the loadMore() callback. */
export function useUnifiedSearch(keyword: string) {
  const [results, setResults] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasMore, setHasMore] = useState(true);
  const [sourceStatus, setSourceStatus] = useState<Record<string, "idle" | "loading" | "done" | "empty">>({});

  // Per-source pagination state: which page each source is on, and whether it has more
  const sourcePageRef = useRef<Record<string, number>>({});
  const sourceHasMoreRef = useRef<Record<string, boolean>>({});

  /** Merge new items into existing results, deduping by title+year+type. */
  const mergeResults = useCallback((newItems: UnifiedItem[], sourceId: SourceId) => {
    setResults((prev) => {
      const seen = new Set(prev.map((r) => `${r.title.toLowerCase().trim()}|${r.year || ""}|${r.type}`));
      const fresh = newItems.filter((r) => !seen.has(`${r.title.toLowerCase().trim()}|${r.year || ""}|${r.type}`));
      return [...prev, ...fresh];
    });
  }, []);

  /** Fire a single source's search and stream results immediately. */
  const searchSource = useCallback(async (sourceId: SourceId, q: string, page: number) => {
    const source = SOURCES.find((s) => s.id === sourceId);
    if (!source) return;

    setSourceStatus((prev) => ({ ...prev, [sourceId]: "loading" }));

    try {
      const items = await safeAll(source.search(q, page), 12000);
      if (items.length === 0) {
        setSourceStatus((prev) => ({ ...prev, [sourceId]: "empty" }));
        sourceHasMoreRef.current[sourceId] = false;
      } else {
        mergeResults(items, sourceId);
        setSourceStatus((prev) => ({ ...prev, [sourceId]: "done" }));
        // Heuristic: if we got a full page, assume more might be available
        sourceHasMoreRef.current[sourceId] = items.length >= 10;
      }
    } catch {
      setSourceStatus((prev) => ({ ...prev, [sourceId]: "empty" }));
      sourceHasMoreRef.current[sourceId] = false;
    }

    // Update global hasMore: true if ANY source still has more pages
    const anyHasMore = Object.values(sourceHasMoreRef.current).some((v) => v === true);
    setHasMore(anyHasMore);
  }, [mergeResults]);

  // Initial search — fires all sources in parallel, streams results
  useEffect(() => {
    const q = keyword.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setHasMore(true);
      setSourceStatus({});
      sourcePageRef.current = {};
      sourceHasMoreRef.current = {};
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setResults([]);  // Clear previous results
    sourcePageRef.current = {};
    sourceHasMoreRef.current = {};

    const t = setTimeout(async () => {
      if (cancelled) return;
      // Fire all sources in parallel — each streams results independently
      const promises = SOURCES.map((s) => {
        sourcePageRef.current[s.id] = 0;
        sourceHasMoreRef.current[s.id] = true;
        return searchSource(s.id, q, 0);
      });
      await Promise.allSettled(promises);
      if (!cancelled) setLoading(false);
    }, 300); // debounce 300ms

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [keyword, searchSource]);

  /** Load More — fetches the next page from sources that still have more. */
  const loadMore = useCallback(async () => {
    const q = keyword.trim();
    if (!q || loadingMore) return;

    // Find sources that still have more pages
    const sourcesWithMore = SOURCES.filter((s) => sourceHasMoreRef.current[s.id] !== false);
    if (sourcesWithMore.length === 0) {
      setHasMore(false);
      return;
    }

    setLoadingMore(true);
    try {
      const promises = sourcesWithMore.map(async (s) => {
        const nextPage = (sourcePageRef.current[s.id] || 0) + 1;
        await searchSource(s.id, q, nextPage);
        sourcePageRef.current[s.id] = nextPage;
      });
      await Promise.allSettled(promises);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [keyword, loadingMore, searchSource]);

  return { results, loading, loadingMore, error, hasMore, loadMore, sourceStatus };
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
