/**
 * MovieBox API Client (REAL Backend — verified working with guest JWT)
 *
 * Reverse-engineered from MovieBox APK v3.0.05.0711.03 (com.community.oneroom)
 *
 * Signing (VERIFIED):
 *   signingString = METHOD\nAccept\nContent-Type\nContent-Length\nTimestamp\nBodyMD5\nPath?SortedQuery
 *   - For GET: Accept='ACCEPT_ALL', Content-Type='', Content-Length='' (omitted from headers)
 *   - For POST: Accept='ACCEPT_ALL', Content-Type='application/json', Content-Length=body bytes
 *   - BodyMD5 = MD5(body[:102400]) if body, else ''
 *   - SortedQuery = alphabetically-sorted key=value pairs joined by ampersand (NOT URL-encoded)
 *   signature = Base64(HmacMD5(Base64Decode(SECRET), signingString))
 *   header    = x-tr-signature: '{timestamp}|2|{signature}'
 *
 * Guest auth (VERIFIED):
 *   X-Client-Token = `${ts},${MD5(reverse(ts))}`
 *   X-Client-Info MUST include device_id, mac, imei fields (else server treats as anonymous)
 *   Each browser gets a unique device fingerprint (stored in cookie) → unique visitor userId
 *   Server returns X-User response header with JSON: {token, userId, userType}
 *   Use JWT as: Authorization: Bearer {token}
 *
 * Region/IP handling:
 *   X-Forwarded-For is set to the USER'S REAL IP by default (read from request headers).
 *   This is what the original APK does — MovieBox blocks server/datacenter IPs, NOT
 *   user IPs, so the app works in India, Pakistan, Africa, etc.
 *   User can optionally override with a specific region's IP in Profile → Identity & Region.
 *
 * Base URL: https://api6.aoneroom.com/wefeed-mobile-bff
 */

import crypto from "crypto";
import { getDeviceFingerprint, getBypassIp, getRegion, getTimezone, getUserRealIp, REGIONS } from "./device";

// === Secrets (from AndroidManifest) ===
const PROD_SECRET_RAW = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
function getHmacKey(): Buffer {
  return Buffer.from(PROD_SECRET_RAW, "base64");
}

// === API hosts (try in order) ===
const API_HOSTS = [
  "https://api6.aoneroom.com",
  "https://api3.aoneroom.com",
  "https://api4.aoneroom.com",
  "https://api5.aoneroom.com",
  "https://api4sg.aoneroom.com",
  "https://api.inmoviebox.com",
];
const BASE_PATH = "/wefeed-mobile-bff";

// === H5 API (public, no signing, used by movie-box.co website) ===
// Returns the same content as the mobile API but CORS-enabled and unauthenticated
// for browsing endpoints. We use it for homepage + trending to avoid signing overhead.
const H5_HOST = "https://h5-api.aoneroom.com";
const H5_BASE_PATH = "/wefeed-h5api-bff";

// === Public H5 endpoints (no auth, no signing) ===
// optimizeImage() has been moved to src/lib/image.ts so it can be imported from client components
export async function getHomeData(): Promise<any> {
  const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/home?host=movie-box.co`, {
    headers: { Accept: "application/json" },
  });
  return res.json();
}

export async function getH5Trending(page = 0, perPage = 18): Promise<any> {
  const res = await fetch(
    `${H5_HOST}${H5_BASE_PATH}/subject/trending?page=${page}&perPage=${perPage}`,
    { headers: { Accept: "application/json" } }
  );
  return res.json();
}

export async function getBottomTabs(): Promise<any> {
  const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/tab/get-bottom-tab-list`, {
    headers: { Accept: "application/json" },
  });
  return res.json();
}

// === App constants ===
const APP_KEY = "d3d3Lm1vdmllYm94b25saW5lLmNvbQ==";
const APP_VERSION = "3.0.05.0711.03";
const APP_ID = "1";

// === Per-browser state (read from cookies + request headers) ===
// Each browser gets its own device fingerprint + chosen region.
// By default, we pass the user's REAL IP to MovieBox (not a fake African one)
// because MovieBox blocks server/datacenter IPs, not user IPs.
async function getClientInfo(): Promise<string> {
  const device = await getDeviceFingerprint();
  const timezone = await getTimezone();
  return JSON.stringify({
    appkey: APP_KEY,
    app_version: APP_VERSION,
    appid: APP_ID,
    device: "2", // 2 = Android
    lang: "en",
    device_id: device.device_id,
    mac: device.mac,
    imei: device.imei,
    timezone,
  });
}

// === JWT cache (per-device, since each browser has its own fingerprint) ===
interface JwtCacheEntry {
  jwt: string;
  expiresAt: number;
  userId?: string;
}
const jwtCache = new Map<string, JwtCacheEntry>(); // keyed by device_id

// === Helpers ===
function md5(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex");
}
function hmacMd5B64(key: Buffer, data: string): string {
  return crypto.createHmac("md5", key).update(data).digest("base64");
}
function reverseStr(s: string): string {
  return s.split("").reverse().join("");
}
function sortQuery(query: Record<string, string> = {}): string {
  return Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");
}
function buildClientToken(ts: string): string {
  return `${ts},${md5(reverseStr(ts))}`;
}

function buildSignString(opts: {
  method: string;
  path: string;
  query: Record<string, string>;
  body: string;
  timestamp: string;
  accept: string;
  contentType: string;
  contentLength: string;
}): string {
  const bodyMd5 = opts.body ? md5(opts.body.slice(0, 102400)) : "";
  const sortedQuery = sortQuery(opts.query);
  const pathWithQuery = sortedQuery ? `${opts.path}?${sortedQuery}` : opts.path;
  return [
    opts.method.toUpperCase(),
    opts.accept || "",
    opts.contentType || "",
    opts.contentLength || "",
    opts.timestamp,
    bodyMd5,
    pathWithQuery,
  ].join("\n");
}

/**
 * Acquire a guest JWT by hitting /subject-api/trending/v2 with full device info.
 * Server returns X-User response header with JSON: {token, userId, userType}
 *
 * Each browser gets its own JWT (keyed by device_id from the per-browser cookie).
 */
export async function getGuestJwt(): Promise<string> {
  const device = await getDeviceFingerprint();
  const cached = jwtCache.get(device.device_id);
  if (cached && Date.now() < cached.expiresAt) return cached.jwt;

  const clientInfo = await getClientInfo();
  const bypassIp = await getBypassIp();

  const ts = Date.now().toString();
  const bodyObj = { category: "movie", page: 1, size: 1 };
  const bodyStr = JSON.stringify(bodyObj);
  const accept = "*/*";
  const contentType = "application/json";
  const contentLength = Buffer.byteLength(bodyStr).toString();

  const query: Record<string, string> = {
    appkey: APP_KEY,
    app_version: APP_VERSION,
    appid: APP_ID,
    device: "2",
    lang: "en",
  };

  const path = `${BASE_PATH}/subject-api/trending/v2`;
  const signString = buildSignString({
    method: "POST",
    path,
    query,
    body: bodyStr,
    timestamp: ts,
    accept,
    contentType,
    contentLength,
  });
  const sig = hmacMd5B64(getHmacKey(), signString);

  for (const host of API_HOSTS) {
    const url = new URL(host + path);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: accept,
          "Content-Type": contentType,
          "x-tr-signature": `${ts}|2|${sig}`,
          "X-Client-Token": buildClientToken(ts),
          "X-Client-Info": clientInfo,
          "X-Client-Status": "1",
          "X-Forwarded-For": bypassIp,
          "User-Agent": "okhttp/4.12.0",
        },
        body: bodyStr,
      });

      // Parse X-User header (JSON: {token, userId, userType})
      const xUserRaw = res.headers.get("x-user") || res.headers.get("X-User");
      if (xUserRaw) {
        try {
          const parsed = JSON.parse(xUserRaw);
          const token = parsed.token || parsed.jwt;
          if (token) {
            jwtCache.set(device.device_id, {
              jwt: token,
              expiresAt: Date.now() + 50 * 60 * 1000,
              userId: parsed.userId,
            });
            return token;
          }
        } catch {
          if (xUserRaw.length > 50) {
            jwtCache.set(device.device_id, {
              jwt: xUserRaw,
              expiresAt: Date.now() + 50 * 60 * 1000,
            });
            return xUserRaw;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return "";
}

/**
 * Get the visitor userId for the current browser (for display in Profile).
 */
export async function getVisitorUserId(): Promise<string | undefined> {
  const device = await getDeviceFingerprint();
  return jwtCache.get(device.device_id)?.userId;
}

/**
 * Get the current device fingerprint (for display in Profile).
 */
export async function getCurrentDevice() {
  return getDeviceFingerprint();
}

/**
 * Sign a request and execute it against the MovieBox gateway.
 * Auto-acquires JWT if needed.
 */
export async function signedRequest<T = any>(opts: {
  method?: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: any;
  auth?: boolean; // include guest JWT (default true)
}): Promise<T> {
  const method = opts.method || "GET";
  const useAuth = opts.auth !== false;

  const device = await getDeviceFingerprint();
  const clientInfo = await getClientInfo();
  const bypassIp = await getBypassIp();
  const jwt = useAuth ? await getGuestJwt() : "";

  const ts = Date.now().toString();
  const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
  const accept = "*/*";
  const contentType = method === "POST" ? "application/json" : "";
  const contentLength = bodyStr ? Buffer.byteLength(bodyStr).toString() : "";

  const query: Record<string, string> = {
    appkey: APP_KEY,
    app_version: APP_VERSION,
    appid: APP_ID,
    device: "2",
    lang: "en",
    ...(opts.query || {}),
  };

  const signString = buildSignString({
    method,
    path: opts.path,
    query,
    body: bodyStr,
    timestamp: ts,
    accept,
    contentType,
    contentLength,
  });
  const sig = hmacMd5B64(getHmacKey(), signString);

  let lastError: any = null;
  for (const host of API_HOSTS) {
    const url = new URL(host + opts.path);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

    const headers: Record<string, string> = {
      Accept: accept,
      "x-tr-signature": `${ts}|2|${sig}`,
      "X-Client-Token": buildClientToken(ts),
      "X-Client-Info": clientInfo,
      "X-Client-Status": "1",
      "X-Forwarded-For": bypassIp,
      "User-Agent": "okhttp/4.12.0",
    };
    if (method === "POST") headers["Content-Type"] = contentType;
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: bodyStr || undefined,
      });
      const text = await res.text();

      // Capture refreshed JWT
      const xUserRaw = res.headers.get("x-user") || res.headers.get("X-User");
      if (xUserRaw) {
        try {
          const parsed = JSON.parse(xUserRaw);
          if (parsed.token) {
            jwtCache.set(device.device_id, {
              jwt: parsed.token,
              expiresAt: Date.now() + 50 * 60 * 1000,
              userId: parsed.userId,
            });
          }
        } catch {
          if (xUserRaw.length > 50) {
            jwtCache.set(device.device_id, {
              jwt: xUserRaw,
              expiresAt: Date.now() + 50 * 60 * 1000,
            });
          }
        }
      }

      if (res.status >= 500) {
        lastError = new Error(`Server ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch (e) {
      lastError = e;
      continue;
    }
  }

  throw lastError || new Error("All API hosts failed");
}

// === High-level endpoints (all now work with guest JWT) ===

export interface MovieItem {
  id: string;
  type: "movie" | "tv";
  title: string;
  posterUrl?: string;
  coverUrl?: string;
  rating?: number;
  year?: string;
  releaseDate?: string;
  genre?: string;
  genres: string[];
  country?: string;
  language?: string;
  duration?: string;
  durationSeconds?: number;
  overview?: string;
  description?: string;
  imdbId?: string;
}

export interface PlayStream {
  format: string;
  id: string;
  url: string;
  resolutions: string;
  size: string;
  duration: number;
  codecName: string;
  signCookie?: string;
  idType?: string;
}

// Trending (REQUIRES guest JWT — also used to acquire it)
export async function getTrending(category: "movie" | "tv" = "movie", page = 1, size = 20) {
  return signedRequest({
    method: "POST",
    path: `${BASE_PATH}/subject-api/trending/v2`,
    body: { category, page, size },
  });
}

// Hot/trending content (NO auth required)
export async function getSearchRank() {
  return signedRequest({
    auth: false,
    path: `${BASE_PATH}/subject-api/search-rank/v2`,
  });
}

// Top recommendations (NO auth required)
export async function getTopRec(size = 20) {
  return signedRequest({
    auth: false,
    method: "POST",
    path: `${BASE_PATH}/subject-api/top-rec`,
    body: { size },
  });
}

// List by category (NO auth required)
export async function getList(category: "movie" | "tv" = "movie", page = 1, size = 20) {
  return signedRequest({
    auth: false,
    method: "POST",
    path: `${BASE_PATH}/subject-api/list`,
    body: { category, page, size },
  });
}

// Search suggestions (NO auth required)
export async function getSearchSuggestions(keyword: string) {
  return signedRequest({
    auth: false,
    path: `${BASE_PATH}/subject-api/search-suggest`,
    query: { keyword },
  });
}

// Full search (REQUIRES guest JWT)
export async function searchAll(keyword: string, page = 1, size = 20) {
  return signedRequest({
    method: "POST",
    path: `${BASE_PATH}/subject-api/search/v2`,
    body: { keyword, page, size },
  });
}

// Subject detail (REQUIRES guest JWT — uses subjectId param, NOT id)
export async function getSubjectDetail(subjectId: string) {
  return signedRequest({
    path: `${BASE_PATH}/subject-api/get`,
    query: { subjectId },
  });
}

// Play info (REQUIRES guest JWT — uses subjectId param, returns streams array)
export async function getPlayInfo(subjectId: string, episodeId?: string) {
  const query: Record<string, string> = { subjectId };
  if (episodeId) query.episodeId = episodeId;
  return signedRequest({
    path: `${BASE_PATH}/subject-api/play-info`,
    query,
  });
}

// Season info (REQUIRES guest JWT — uses subjectId param)
export async function getSeasonInfo(subjectId: string) {
  return signedRequest({
    path: `${BASE_PATH}/subject-api/season-info`,
    query: { subjectId },
  });
}

// Cast/crew info (REQUIRES guest JWT — uses subjectId param)
export async function getStaffInfo(subjectId: string) {
  return signedRequest({
    path: `${BASE_PATH}/subject-api/staff-info`,
    query: { subjectId },
  });
}

// Recommendations (REQUIRES guest JWT — uses id in body as number)
export async function getDetailRec(subjectId: string, size = 12) {
  return signedRequest({
    method: "POST",
    path: `${BASE_PATH}/subject-api/detail-rec`,
    body: { id: Number(subjectId), size },
  });
}

// Bottom tab config (REQUIRES guest JWT)
export async function getBottomTab() {
  return signedRequest({
    path: `${BASE_PATH}/subject-api/bottom-tab`,
  });
}

// Ranking list (REQUIRES guest JWT)
export async function getRankingList() {
  return signedRequest({
    path: `${BASE_PATH}/tab/ranking-list`,
  });
}

// === Normalizers ===

function pickList(raw: any): any[] {
  if (!raw) return [];

  // search-rank/v2 shape: data.hot[] is array of category groups, each with items[]
  if (Array.isArray(raw?.data?.hot)) {
    return raw.data.hot.flatMap((cat: any) => cat?.items || []);
  }

  // trending/v2 + search/v2 + list shapes: items[] with subject nested
  if (Array.isArray(raw?.data?.items)) {
    return raw.data.items.map((it: any) => it.subject || it);
  }
  // top-rec shape: items[] may be flat
  if (Array.isArray(raw?.data?.results)) {
    return raw.data.results.flatMap((r: any) => r.subjects || [r]);
  }

  // Fallback: walk the tree
  const candidates = [
    raw?.data?.list,
    raw?.data?.rows,
    raw?.data?.recommendList,
    raw?.data?.subjectList,
    raw?.data?.movies,
    raw?.data,
    raw?.list,
    raw?.results,
    raw?.items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function parseSubjectType(t: any): "movie" | "tv" {
  const n = Number(t);
  if (n === 2 || n === 4) return "tv";
  return "movie";
}

function parseGenres(s: any): string[] {
  if (Array.isArray(s)) return s;
  if (typeof s === "string" && s) {
    return s.split(/[,/|]/).map((g) => g.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeItems(raw: any): MovieItem[] {
  const list = pickList(raw);
  return list.map((it: any) => {
    const id = String(it.subjectId || it.id || it.subject_id || "");
    return {
      id,
      type: parseSubjectType(it.subjectType || it.type),
      title: it.title || it.name || it.movieName || it.tvName || "Untitled",
      posterUrl: it.cover?.url || it.posterUrl || it.cover || it.imageUrl || it.image,
      coverUrl: it.cover?.url,
      rating: Number(it.imdbRatingValue || it.rating || it.score || 0) || undefined,
      year: it.releaseDate ? String(it.releaseDate).slice(0, 4) : it.year,
      releaseDate: it.releaseDate || it.airDate,
      genre: it.genre,
      genres: parseGenres(it.genre || it.genres),
      country: it.countryName || it.country,
      language: it.language,
      duration: it.duration,
      durationSeconds: it.durationSeconds,
      overview: it.description || it.intro || it.synopsis,
      description: it.description,
      imdbId: it.imdbId,
    } as MovieItem;
  }).filter((it) => it.id && it.title);
}

export function normalizeDetail(raw: any): any {
  return raw?.data || raw?.subject || raw;
}

export function normalizePlaySources(raw: any): PlayStream[] {
  if (!raw) return [];
  // play-info returns: data.streams[]
  const streams = raw?.data?.streams;
  if (Array.isArray(streams)) return streams as PlayStream[];

  // Fallback for other shapes
  const list =
    raw?.data?.playUrlList ||
    raw?.data?.sources ||
    raw?.data?.list ||
    raw?.data?.resources ||
    raw?.data ||
    [];
  if (!Array.isArray(list)) return [];
  return list as PlayStream[];
}
