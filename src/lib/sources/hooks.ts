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

  /** Fire a single source's search and stream results immediately.
   *  Returns the number of NEW items actually added (after dedup). */
  const searchSource = useCallback(async (sourceId: SourceId, q: string, page: number): Promise<number> => {
    const source = SOURCES.find((s) => s.id === sourceId);
    if (!source) return 0;

    // Only show "loading" status for initial search (page 0), not for Load More
    if (page === 0) {
      setSourceStatus((prev) => ({ ...prev, [sourceId]: "loading" }));
    }

    try {
      // Increased timeout: HDA/AV can take 8-10s on slow connections.
      // Previous 12s was too tight — now 20s gives slow sources time to complete.
      const items = await safeAll(source.search(q, page), 20000);

      // === Relevance filtering ===
      // Some sources (HDA via WP REST, MB) do full-text search and return
      // irrelevant matches. Filter to keep only items whose title contains
      // the query (token-by-token, all tokens must match).
      const kwTokens = q.toLowerCase().trim().split(/\s+/).filter((t) => t.length >= 2);
      const filtered = items.filter((item) => {
        if (!item.title) return false;
        const titleLower = item.title.toLowerCase();
        // All query tokens must appear in the title (order-independent)
        return kwTokens.every((tok) => titleLower.includes(tok));
      });

      if (filtered.length === 0) {
        if (page === 0) setSourceStatus((prev) => ({ ...prev, [sourceId]: "empty" }));
        sourceHasMoreRef.current[sourceId] = false;
        return 0;
      }

      // Merge and count how many were actually new
      let newCount = 0;
      setResults((prev) => {
        // Dedup by normalized title only (year is often missing → false dedup before)
        const seen = new Set(prev.map((r) => r.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "")));
        const fresh = filtered.filter((r) => {
          const key = r.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        newCount = fresh.length;
        return [...prev, ...fresh];
      });

      if (page === 0) setSourceStatus((prev) => ({ ...prev, [sourceId]: "done" }));

      // If we got items but ALL were dupes, this source doesn't support pagination
      if (page > 0 && newCount === 0) {
        sourceHasMoreRef.current[sourceId] = false;
      } else if (filtered.length < 8) {
        // Few results = likely last page
        sourceHasMoreRef.current[sourceId] = false;
      } else {
        // Full page of new results = more might be available
        sourceHasMoreRef.current[sourceId] = true;
      }

      return newCount;
    } catch {
      if (page === 0) setSourceStatus((prev) => ({ ...prev, [sourceId]: "empty" }));
      sourceHasMoreRef.current[sourceId] = false;
      return 0;
    }
  }, []);

  // Update global hasMore after each source completes
  const updateGlobalHasMore = useCallback(() => {
    const anyHasMore = Object.values(sourceHasMoreRef.current).some((v) => v === true);
    setHasMore(anyHasMore);
  }, []);

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
      const promises = SOURCES.map(async (s) => {
        sourcePageRef.current[s.id] = 0;
        sourceHasMoreRef.current[s.id] = true;
        await searchSource(s.id, q, 0);
        updateGlobalHasMore();
      });
      await Promise.allSettled(promises);
      if (!cancelled) setLoading(false);
    }, 300); // debounce 300ms

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [keyword, searchSource, updateGlobalHasMore]);

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
    let totalNewItems = 0;
    try {
      const promises = sourcesWithMore.map(async (s) => {
        const nextPage = (sourcePageRef.current[s.id] || 0) + 1;
        const newCount = await searchSource(s.id, q, nextPage);
        sourcePageRef.current[s.id] = nextPage;
        totalNewItems += newCount;
      });
      await Promise.allSettled(promises);
      updateGlobalHasMore();
      // If no source returned any new items, hide the Load More button
      if (totalNewItems === 0) {
        setHasMore(false);
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [keyword, loadingMore, searchSource, updateGlobalHasMore]);

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
