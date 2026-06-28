import { NextRequest, NextResponse } from "next/server";
import {
  getSearchRank,
  getTopRec,
  getList,
  getSearchSuggestions,
  getTrending,
  searchAll,
  getSubjectDetail,
  getPlayInfo,
  getSeasonInfo,
  getStaffInfo,
  getDetailRec,
  getVisitorUserId,
  getCurrentDevice,
  getHomeData,
  getH5Trending,
  getBottomTabs,
  normalizeItems,
  normalizePlaySources,
} from "@/lib/moviebox";
import {
  getDeviceFingerprint,
  getRegion,
  setRegion,
  resetDeviceFingerprint,
  REGIONS,
  getUserRealIp,
  getBypassIp,
} from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// === In-memory cache (5-min TTL) ===
// Avoids re-fetching the same data from MovieBox on every page load.
// First user pays the latency; subsequent users get instant response.
interface CacheEntry<T> { data: T; expiresAt: number; }
const apiCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function cached<T>(key: string, fn: () => Promise<T>, ttlMs: number = CACHE_TTL_MS): Promise<T> {
  const cached_entry = apiCache.get(key);
  if (cached_entry && Date.now() < cached_entry.expiresAt) {
    return cached_entry.data;
  }
  const data = await fn();
  apiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

// === Pre-warm cache on server startup ===
// Fires off background fetches so the first user never waits for a cold cache.
// Errors are silently ignored — the cache will just be cold if MovieBox is unreachable.
let warmedUp = false;
async function warmUpCache() {
  if (warmedUp) return;
  warmedUp = true;
  // Fire all fetches in parallel, don't await — let them populate the cache in background
  Promise.allSettled([
    cached("home", () => getHomeData().then((raw) => {
      const operating: any[] = raw?.data?.operatingList || [];
      const sections = operating
        .filter((op) => op.type !== "BANNER" && op.subjects?.length > 0)
        .map((op) => ({
          title: op.title || op.type,
          type: op.type,
          items: trimItems(op.subjects).slice(0, 12),
        }))
        .filter((s: any) => s.items.length > 0);
      return { banners: sections[0]?.items?.slice(0, 6) || [], sections, platforms: (raw?.data?.platformList || []).map((p) => ({ name: p.name })) };
    })),
    cached("hot", () => trimItems(normalizeItemsRaw(getSearchRank()))),
  ]).catch(() => { /* silent */ });
}
// Kick off warm-up (doesn't block module load)
warmUpCache();

// Extract raw subject list from any API response shape
function normalizeItemsRaw(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw?.data?.hot)) {
    return raw.data.hot.flatMap((cat: any) => cat?.items || []);
  }
  if (Array.isArray(raw?.data?.items)) {
    return raw.data.items.map((it: any) => it.subject || it);
  }
  if (Array.isArray(raw?.data?.results)) {
    return raw.data.results.flatMap((r: any) => r.subjects || [r]);
  }
  const candidates = [
    raw?.data?.list, raw?.data?.rows, raw?.data?.recommendList,
    raw?.data?.subjectList, raw?.data?.movies, raw?.data, raw?.list, raw?.results, raw?.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

// Trim the heavy fields we don't use client-side, to reduce payload size
function trimItems(items: any[]) {
  return items.map((it: any) => ({
    id: String(it.subjectId || it.id || ""),
    type: Number(it.subjectType) === 2 || Number(it.subjectType) === 4 ? "tv" : "movie",
    title: it.title || it.name || "Untitled",
    posterUrl: it.cover?.url || it.posterUrl,
    coverUrl: it.cover?.url,
    rating: Number(it.imdbRatingValue) || undefined,
    year: it.releaseDate ? String(it.releaseDate).slice(0, 4) : undefined,
    releaseDate: it.releaseDate,
    genre: it.genre,
    genres: typeof it.genre === "string" ? it.genre.split(/[,/|]/).map((g) => g.trim()).filter(Boolean) : [],
    country: it.countryName,
    language: it.language,
    duration: it.duration,
    durationSeconds: it.durationSeconds,
    overview: (it.description || "").slice(0, 300),
  })).filter((it: any) => it.id && it.title);
}

// GET /api/moviebox?action=home        → full homepage data via h5-api (no auth)
// GET /api/moviebox?action=hot            → hot movies + shows (search-rank/v2)
// GET /api/moviebox?action=top            → top recommendations
// GET /api/moviebox?action=list&category=movie&page=1
// GET /api/moviebox?action=trending&category=movie&page=1   (REQUIRES guest JWT — full data)
// GET /api/moviebox?action=h5-trending    → trending via public h5-api (no auth, faster)
// GET /api/moviebox?action=search&keyword=foo               (REQUIRES guest JWT)
// GET /api/moviebox?action=suggest&keyword=foo              (no auth)
// GET /api/moviebox?action=detail&subjectId=...             (REQUIRES guest JWT)
// GET /api/moviebox?action=play&subjectId=...&episodeId=... (REQUIRES guest JWT — returns streams!)
// GET /api/moviebox?action=seasons&subjectId=...            (REQUIRES guest JWT)
// GET /api/moviebox?action=staff&subjectId=...              (REQUIRES guest JWT — cast/crew)
// GET /api/moviebox?action=recs&subjectId=...               (REQUIRES guest JWT)
// GET /api/moviebox?action=whoami            → returns this browser's device fingerprint + visitor userId
// GET /api/moviebox?action=regions           → returns list of available regions
// GET /api/moviebox?action=bottom-tabs       → bottom tab config via h5-api
// POST /api/moviebox?action=set-region       → sets the region cookie (body: {region: "NG"})
// POST /api/moviebox?action=reset-identity   → clears the device cookie (forces new visitor account)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "home";

  try {
    // === Identity & region endpoints ===
    if (action === "whoami") {
      const device = await getDeviceFingerprint();
      const region = await getRegion();
      const realIp = await getUserRealIp();
      const effectiveIp = await getBypassIp();
      const userId = await getVisitorUserId();
      return NextResponse.json({
        device: {
          device_id: device.device_id,
          mac: device.mac,
          imei: device.imei,
        },
        region,
        regionInfo: REGIONS[region] || REGIONS.AUTO,
        realIp: realIp || "(not available — running locally?)",
        effectiveIp,
        usingRealIp: region === "AUTO" && !!realIp,
        visitorUserId: userId,
        note: userId
          ? "You have a unique visitor account on MovieBox."
          : "Visit any title to acquire your visitor account.",
      });
    }

    if (action === "regions") {
      return NextResponse.json({
        regions: Object.entries(REGIONS).map(([code, info]) => ({
          code,
          name: info.name,
          timezone: info.timezone,
        })),
      });
    }

    if (action === "home") {
      const data = await cached("home", async () => {
        const raw = await getHomeData();
        const operating: any[] = raw?.data?.operatingList || [];
        const platformList: any[] = raw?.data?.platformList || [];

        // Build sections — trim items and slice to 10 per section to keep payload small
        const sections = operating
          .filter((op) => op.type !== "BANNER" && op.subjects?.length > 0)
          .map((op) => ({
            title: op.title || op.type,
            type: op.type,
            items: trimItems(op.subjects).slice(0, 12), // cap at 12 per section
          }))
          .filter((s: any) => s.items.length > 0);

        // Pick top items across all sections for the hero carousel
        const heroItems = sections[0]?.items?.slice(0, 6) || [];

        return { banners: heroItems, sections, platforms: platformList.map((p) => ({ name: p.name })) };
      });
      return NextResponse.json(data);
    }

    if (action === "h5-trending") {
      const page = Number(url.searchParams.get("page") || "0");
      const perPage = Number(url.searchParams.get("perPage") || "18");
      const raw = await getH5Trending(page, perPage);
      return NextResponse.json({
        items: normalizeItems({ data: { items: raw?.data?.subjectList || [] } }),
        raw,
      });
    }

    if (action === "bottom-tabs") {
      const raw = await getBottomTabs();
      return NextResponse.json({ tabs: raw?.data?.bottomTabs || [], raw });
    }

    switch (action) {
      case "hot": {
        const items = await cached("hot", async () => trimItems(normalizeItemsRaw(await getSearchRank())));
        return NextResponse.json({ items });
      }
      case "top": {
        const items = await cached("top", async () => trimItems(normalizeItemsRaw(await getTopRec(20))));
        return NextResponse.json({ items });
      }
      case "list": {
        const category = (url.searchParams.get("category") || "movie") as "movie" | "tv";
        const page = Number(url.searchParams.get("page") || "1");
        const size = Number(url.searchParams.get("size") || "20");
        const result = await cached(`list:${category}:${page}:${size}`, async () => {
          const raw = await getList(category, page, size);
          return {
            items: trimItems(normalizeItemsRaw(raw)),
            pager: raw?.data?.pager,
          };
        });
        return NextResponse.json(result);
      }
      case "trending": {
        const category = (url.searchParams.get("category") || "movie") as "movie" | "tv";
        const page = Number(url.searchParams.get("page") || "1");
        const size = Number(url.searchParams.get("size") || "20");
        const result = await cached(`trending:${category}:${page}:${size}`, async () => {
          const raw = await getTrending(category, page, size);
          return {
            items: trimItems(normalizeItemsRaw(raw)),
            pager: raw?.data?.pager,
          };
        });
        return NextResponse.json(result);
      }
      case "search": {
        const keyword = url.searchParams.get("keyword") || "";
        if (!keyword.trim()) return NextResponse.json({ items: [] });
        // Search results change by keyword — cache per keyword for 2 min
        const cacheKey = `search:${keyword}`;
        const items = await cached(cacheKey, async () => trimItems(normalizeItemsRaw(await searchAll(keyword))), 2 * 60 * 1000);
        return NextResponse.json({ items });
      }
      case "suggest": {
        const keyword = url.searchParams.get("keyword") || "";
        if (!keyword.trim()) return NextResponse.json({ items: [] });
        const items = await cached(`suggest:${keyword}`, async () => trimItems(normalizeItemsRaw(await getSearchSuggestions(keyword))), 2 * 60 * 1000);
        return NextResponse.json({ items });
      }
      case "detail": {
        const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
        if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });
        const raw = await getSubjectDetail(subjectId);
        const detail = raw?.data || raw?.subject || raw;
        return NextResponse.json({ detail, raw });
      }
      case "play": {
        const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
        if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });
        const episodeId = url.searchParams.get("episodeId") || undefined;
        const raw = await getPlayInfo(subjectId, episodeId);
        return NextResponse.json({
          streams: normalizePlaySources(raw),
          title: raw?.data?.title,
          raw,
        });
      }
      case "seasons": {
        const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
        if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });
        const raw = await getSeasonInfo(subjectId);
        return NextResponse.json({ seasons: raw?.data || raw, raw });
      }
      case "staff": {
        const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
        if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });
        const raw = await getStaffInfo(subjectId);
        return NextResponse.json({ staff: raw?.data || raw, raw });
      }
      case "recs": {
        const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
        if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });
        const raw = await getDetailRec(subjectId);
        return NextResponse.json({ items: normalizeItems(raw), raw });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "request failed" },
      { status: 500 }
    );
  }
}

// POST handler for set-region and reset-identity
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "set-region") {
      const body = await req.json();
      const region = body?.region;
      if (!region || !REGIONS[region as keyof typeof REGIONS]) {
        return NextResponse.json(
          { error: "Invalid region. Use GET ?action=regions to see valid options." },
          { status: 400 }
        );
      }
      await setRegion(region);
      return NextResponse.json({
        ok: true,
        region,
        regionInfo: REGIONS[region as keyof typeof REGIONS],
      });
    }

    if (action === "reset-identity") {
      const newDevice = await resetDeviceFingerprint();
      return NextResponse.json({
        ok: true,
        message: "Identity reset. You now have a new visitor account.",
        device: {
          device_id: newDevice.device_id,
          mac: newDevice.mac,
          imei: newDevice.imei,
        },
      });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "request failed" },
      { status: 500 }
    );
  }
}
