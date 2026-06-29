/**
 * React hooks for unified multi-source search & resolve.
 * These call into src/lib/sources/index.ts which fires all sources in parallel.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { unifiedSearch, getUnifiedHome, unifiedResolve } from "./index";
import type { UnifiedItem } from "./types";

/** Unified search — fires all sources in parallel, returns deduped merged results. */
export function useUnifiedSearch(keyword: string) {
  const [results, setResults] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const q = keyword.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const t = setTimeout(async () => {
      try {
        const r = await unifiedSearch(q);
        if (!cancelled) {
          setResults(r);
          setError("");
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

  return { results, loading, error };
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
