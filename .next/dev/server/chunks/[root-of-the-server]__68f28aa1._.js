module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/src/lib/device.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_REGION",
    ()=>DEFAULT_REGION,
    "REGIONS",
    ()=>REGIONS,
    "getBypassIp",
    ()=>getBypassIp,
    "getDeviceFingerprint",
    ()=>getDeviceFingerprint,
    "getRegion",
    ()=>getRegion,
    "getTimezone",
    ()=>getTimezone,
    "getUserRealIp",
    ()=>getUserRealIp,
    "resetDeviceFingerprint",
    ()=>resetDeviceFingerprint,
    "setRegion",
    ()=>setRegion
]);
/**
 * Per-browser device fingerprint + region/IP handling
 *
 * Each browser gets its own unique device_id, mac, imei stored in a cookie.
 * This means each user gets their own visitor JWT and userId from MovieBox.
 *
 * IP handling:
 *   By default, we pass the USER'S REAL IP (from the incoming request headers)
 *   to MovieBox. This is what the original APK does — it works in India, Pakistan,
 *   Africa, etc. because MovieBox blocks server/datacenter IPs, NOT user IPs.
 *
 *   If the user wants to override (e.g. to access a specific region's catalog),
 *   they can pick a country in Profile → Identity & Region, which switches us
 *   to using that region's IP instead.
 *
 * Why cookies (not localStorage)?
 *   - The signing happens server-side (in the API route)
 *   - Server needs to read the fingerprint on every request
 *   - Cookies are sent automatically with every request
 *   - httpOnly cookies can't be tampered with from client JS
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
;
;
const COOKIE_NAME = "zexbox-device";
const REGION_COOKIE_NAME = "zexbox-region";
const REGIONS = {
    AUTO: {
        name: "Auto (my IP)",
        ip: "",
        timezone: "Africa/Lagos"
    },
    NG: {
        name: "Nigeria",
        ip: "102.89.23.1",
        timezone: "Africa/Lagos"
    },
    KE: {
        name: "Kenya",
        ip: "41.90.0.1",
        timezone: "Africa/Nairobi"
    },
    GH: {
        name: "Ghana",
        ip: "41.215.0.1",
        timezone: "Africa/Accra"
    },
    ZA: {
        name: "South Africa",
        ip: "41.0.0.1",
        timezone: "Africa/Johannesburg"
    },
    EG: {
        name: "Egypt",
        ip: "156.200.0.1",
        timezone: "Africa/Cairo"
    },
    TZ: {
        name: "Tanzania",
        ip: "41.59.0.1",
        timezone: "Africa/Dar_es_Salaam"
    },
    UG: {
        name: "Uganda",
        ip: "41.190.0.1",
        timezone: "Africa/Kampala"
    },
    ET: {
        name: "Ethiopia",
        ip: "196.188.0.1",
        timezone: "Africa/Addis_Ababa"
    }
};
const DEFAULT_REGION = "AUTO";
function generateFingerprint() {
    const device_id = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].randomBytes(8).toString("hex");
    const mac = Array.from({
        length: 6
    }, ()=>__TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].randomBytes(1).toString("hex").padStart(2, "0")).join(":").toUpperCase();
    const imei = Array.from({
        length: 15
    }, ()=>__TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].randomInt(0, 10)).join("");
    return {
        device_id,
        mac,
        imei
    };
}
// Static fallback (used when cookies() fails in Vercel serverless cold start)
const FALLBACK_FINGERPRINT = {
    device_id: "z3xb0xfallback01",
    mac: "00:1A:2B:3C:4D:5E",
    imei: "490154203237518"
};
async function getDeviceFingerprint() {
    try {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        const existing = cookieStore.get(COOKIE_NAME);
        if (existing?.value) {
            try {
                const parsed = JSON.parse(existing.value);
                if (parsed.device_id && parsed.mac && parsed.imei) {
                    return parsed;
                }
            } catch  {}
        }
        const fingerprint = generateFingerprint();
        cookieStore.set(COOKIE_NAME, JSON.stringify(fingerprint), {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
            path: "/"
        });
        return fingerprint;
    } catch  {
        return FALLBACK_FINGERPRINT;
    }
}
async function getRegion() {
    try {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        return cookieStore.get(REGION_COOKIE_NAME)?.value || DEFAULT_REGION;
    } catch  {
        return DEFAULT_REGION;
    }
}
async function setRegion(region) {
    try {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        cookieStore.set(REGION_COOKIE_NAME, region, {
            httpOnly: false,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
            path: "/"
        });
    } catch  {}
}
async function getUserRealIp() {
    try {
        const headerStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["headers"])();
        const cfIp = headerStore.get("cf-connecting-ip");
        if (cfIp && isValidIp(cfIp)) return cfIp;
        const realIp = headerStore.get("x-real-ip");
        if (realIp && isValidIp(realIp)) return realIp;
        const xff = headerStore.get("x-forwarded-for");
        if (xff) {
            const first = xff.split(",")[0]?.trim();
            if (first && isValidIp(first)) return first;
        }
    } catch  {}
    return "";
}
function isValidIp(ip) {
    // IPv4 or IPv6 check
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4.test(ip) || ipv6.test(ip);
}
async function getBypassIp() {
    const region = await getRegion();
    // User explicitly picked a region — use that region's IP
    if (region !== "AUTO" && REGIONS[region]?.ip) {
        return REGIONS[region].ip;
    }
    // AUTO mode:
    // On Vercel/production: always use Nigeria bypass IP (server IPs are blocked)
    // On localhost: use the user's real IP (works for dev)
    const realIp = await getUserRealIp();
    // Check if we're running on localhost (dev) — if so, use real IP
    if (realIp && (realIp === "::1" || realIp === "127.0.0.1" || realIp.startsWith("192.168.") || realIp.startsWith("10."))) {
        // Local dev — use Nigeria IP since localhost won't work with MovieBox either
        return REGIONS.NG.ip;
    }
    // Production (Vercel, etc.) — always use Nigeria bypass IP
    // because server IPs are blocked by MovieBox
    return REGIONS.NG.ip;
}
async function getTimezone() {
    const region = await getRegion();
    return REGIONS[region]?.timezone || REGIONS.NG.timezone;
}
async function resetDeviceFingerprint() {
    try {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        cookieStore.delete(COOKIE_NAME);
    } catch  {}
    return getDeviceFingerprint();
}
}),
"[project]/src/lib/moviebox.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getBottomTab",
    ()=>getBottomTab,
    "getBottomTabs",
    ()=>getBottomTabs,
    "getCurrentDevice",
    ()=>getCurrentDevice,
    "getDetailRec",
    ()=>getDetailRec,
    "getGuestJwt",
    ()=>getGuestJwt,
    "getH5Trending",
    ()=>getH5Trending,
    "getHomeData",
    ()=>getHomeData,
    "getList",
    ()=>getList,
    "getPlayInfo",
    ()=>getPlayInfo,
    "getRankingList",
    ()=>getRankingList,
    "getSearchRank",
    ()=>getSearchRank,
    "getSearchSuggestions",
    ()=>getSearchSuggestions,
    "getSeasonInfo",
    ()=>getSeasonInfo,
    "getStaffInfo",
    ()=>getStaffInfo,
    "getSubjectDetail",
    ()=>getSubjectDetail,
    "getTopRec",
    ()=>getTopRec,
    "getTrending",
    ()=>getTrending,
    "getVisitorUserId",
    ()=>getVisitorUserId,
    "normalizeDetail",
    ()=>normalizeDetail,
    "normalizeItems",
    ()=>normalizeItems,
    "normalizePlaySources",
    ()=>normalizePlaySources,
    "searchAll",
    ()=>searchAll,
    "signedRequest",
    ()=>signedRequest
]);
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
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/device.ts [app-route] (ecmascript)");
;
;
// === Secrets (from AndroidManifest) ===
const PROD_SECRET_RAW = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
function getHmacKey() {
    return Buffer.from(PROD_SECRET_RAW, "base64");
}
// === API hosts (try in order) ===
const API_HOSTS = [
    "https://api6.aoneroom.com",
    "https://api3.aoneroom.com",
    "https://api4.aoneroom.com",
    "https://api5.aoneroom.com",
    "https://api4sg.aoneroom.com",
    "https://api.inmoviebox.com"
];
const BASE_PATH = "/wefeed-mobile-bff";
// === H5 API (public, no signing, used by movie-box.co website) ===
// Returns the same content as the mobile API but CORS-enabled and unauthenticated
// for browsing endpoints. We use it for homepage + trending to avoid signing overhead.
const H5_HOST = "https://h5-api.aoneroom.com";
const H5_BASE_PATH = "/wefeed-h5api-bff";
async function getHomeData() {
    const bypassIp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBypassIp"])();
    const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/home?host=movie-box.co`, {
        headers: {
            Accept: "application/json",
            "X-Forwarded-For": bypassIp
        }
    });
    return res.json();
}
async function getH5Trending(page = 0, perPage = 18) {
    const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/subject/trending?page=${page}&perPage=${perPage}`, {
        headers: {
            Accept: "application/json"
        }
    });
    return res.json();
}
async function getBottomTabs() {
    const res = await fetch(`${H5_HOST}${H5_BASE_PATH}/tab/get-bottom-tab-list`, {
        headers: {
            Accept: "application/json"
        }
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
async function getClientInfo() {
    const device = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDeviceFingerprint"])();
    const timezone = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTimezone"])();
    return JSON.stringify({
        appkey: APP_KEY,
        app_version: APP_VERSION,
        appid: APP_ID,
        device: "2",
        lang: "en",
        device_id: device.device_id,
        mac: device.mac,
        imei: device.imei,
        timezone
    });
}
const jwtCache = new Map(); // keyed by device_id
// === Helpers ===
function md5(s) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHash("md5").update(s).digest("hex");
}
function hmacMd5B64(key, data) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHmac("md5", key).update(data).digest("base64");
}
function reverseStr(s) {
    return s.split("").reverse().join("");
}
function sortQuery(query = {}) {
    return Object.keys(query).sort().map((k)=>`${k}=${query[k]}`).join("&");
}
function buildClientToken(ts) {
    return `${ts},${md5(reverseStr(ts))}`;
}
function buildSignString(opts) {
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
        pathWithQuery
    ].join("\n");
}
async function getGuestJwt() {
    const device = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDeviceFingerprint"])();
    const cached = jwtCache.get(device.device_id);
    if (cached && Date.now() < cached.expiresAt) return cached.jwt;
    const clientInfo = await getClientInfo();
    const bypassIp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBypassIp"])();
    const ts = Date.now().toString();
    const bodyObj = {
        category: "movie",
        page: 1,
        size: 1
    };
    const bodyStr = JSON.stringify(bodyObj);
    const accept = "*/*";
    const contentType = "application/json";
    const contentLength = Buffer.byteLength(bodyStr).toString();
    const query = {
        appkey: APP_KEY,
        app_version: APP_VERSION,
        appid: APP_ID,
        device: "2",
        lang: "en"
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
        contentLength
    });
    const sig = hmacMd5B64(getHmacKey(), signString);
    for (const host of API_HOSTS){
        const url = new URL(host + path);
        Object.entries(query).forEach(([k, v])=>url.searchParams.set(k, v));
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
                    "User-Agent": "okhttp/4.12.0"
                },
                body: bodyStr
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
                            userId: parsed.userId
                        });
                        return token;
                    }
                } catch  {
                    if (xUserRaw.length > 50) {
                        jwtCache.set(device.device_id, {
                            jwt: xUserRaw,
                            expiresAt: Date.now() + 50 * 60 * 1000
                        });
                        return xUserRaw;
                    }
                }
            }
        } catch  {
            continue;
        }
    }
    return "";
}
async function getVisitorUserId() {
    const device = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDeviceFingerprint"])();
    return jwtCache.get(device.device_id)?.userId;
}
async function getCurrentDevice() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDeviceFingerprint"])();
}
async function signedRequest(opts) {
    const method = opts.method || "GET";
    const useAuth = opts.auth !== false;
    const device = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDeviceFingerprint"])();
    const clientInfo = await getClientInfo();
    const bypassIp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBypassIp"])();
    const jwt = useAuth ? await getGuestJwt() : "";
    const ts = Date.now().toString();
    const bodyStr = opts.body ? JSON.stringify(opts.body) : "";
    const accept = "*/*";
    const contentType = method === "POST" ? "application/json" : "";
    const contentLength = bodyStr ? Buffer.byteLength(bodyStr).toString() : "";
    const query = {
        appkey: APP_KEY,
        app_version: APP_VERSION,
        appid: APP_ID,
        device: "2",
        lang: "en",
        ...opts.query || {}
    };
    const signString = buildSignString({
        method,
        path: opts.path,
        query,
        body: bodyStr,
        timestamp: ts,
        accept,
        contentType,
        contentLength
    });
    const sig = hmacMd5B64(getHmacKey(), signString);
    let lastError = null;
    for (const host of API_HOSTS){
        const url = new URL(host + opts.path);
        Object.entries(query).forEach(([k, v])=>url.searchParams.set(k, v));
        const headers = {
            Accept: accept,
            "x-tr-signature": `${ts}|2|${sig}`,
            "X-Client-Token": buildClientToken(ts),
            "X-Client-Info": clientInfo,
            "X-Client-Status": "1",
            "X-Forwarded-For": bypassIp,
            "User-Agent": "okhttp/4.12.0"
        };
        if (method === "POST") headers["Content-Type"] = contentType;
        if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
        try {
            const res = await fetch(url, {
                method,
                headers,
                body: bodyStr || undefined
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
                            userId: parsed.userId
                        });
                    }
                } catch  {
                    if (xUserRaw.length > 50) {
                        jwtCache.set(device.device_id, {
                            jwt: xUserRaw,
                            expiresAt: Date.now() + 50 * 60 * 1000
                        });
                    }
                }
            }
            if (res.status >= 500) {
                lastError = new Error(`Server ${res.status}: ${text.slice(0, 200)}`);
                continue;
            }
            try {
                return JSON.parse(text);
            } catch  {
                return text;
            }
        } catch (e) {
            lastError = e;
            continue;
        }
    }
    throw lastError || new Error("All API hosts failed");
}
async function getTrending(category = "movie", page = 1, size = 20) {
    return signedRequest({
        method: "POST",
        path: `${BASE_PATH}/subject-api/trending/v2`,
        body: {
            category,
            page,
            size
        }
    });
}
async function getSearchRank() {
    return signedRequest({
        auth: false,
        path: `${BASE_PATH}/subject-api/search-rank/v2`
    });
}
async function getTopRec(size = 20) {
    return signedRequest({
        auth: false,
        method: "POST",
        path: `${BASE_PATH}/subject-api/top-rec`,
        body: {
            size
        }
    });
}
async function getList(category = "movie", page = 1, size = 20) {
    return signedRequest({
        auth: false,
        method: "POST",
        path: `${BASE_PATH}/subject-api/list`,
        body: {
            category,
            page,
            size
        }
    });
}
async function getSearchSuggestions(keyword) {
    return signedRequest({
        auth: false,
        path: `${BASE_PATH}/subject-api/search-suggest`,
        query: {
            keyword
        }
    });
}
async function searchAll(keyword, page = 0, size = 20) {
    return signedRequest({
        method: "POST",
        path: `${BASE_PATH}/subject-api/search/v2`,
        body: {
            keyword,
            page,
            size
        }
    });
}
async function getSubjectDetail(subjectId) {
    return signedRequest({
        path: `${BASE_PATH}/subject-api/get`,
        query: {
            subjectId
        }
    });
}
async function getPlayInfo(subjectId, episodeId, se, ep) {
    const query = {
        subjectId
    };
    if (episodeId) query.episodeId = episodeId;
    if (se) query.se = String(se);
    if (ep) query.ep = String(ep);
    return signedRequest({
        path: `${BASE_PATH}/subject-api/play-info`,
        query
    });
}
async function getSeasonInfo(subjectId) {
    return signedRequest({
        path: `${BASE_PATH}/subject-api/season-info`,
        query: {
            subjectId
        }
    });
}
async function getStaffInfo(subjectId) {
    return signedRequest({
        path: `${BASE_PATH}/subject-api/staff-info`,
        query: {
            subjectId
        }
    });
}
async function getDetailRec(subjectId, size = 12) {
    return signedRequest({
        method: "POST",
        path: `${BASE_PATH}/subject-api/detail-rec`,
        body: {
            id: Number(subjectId),
            size
        }
    });
}
async function getBottomTab() {
    return signedRequest({
        path: `${BASE_PATH}/subject-api/bottom-tab`
    });
}
async function getRankingList() {
    return signedRequest({
        path: `${BASE_PATH}/tab/ranking-list`
    });
}
// === Normalizers ===
function pickList(raw) {
    if (!raw) return [];
    // search-rank/v2 shape: data.hot[] is array of category groups, each with items[]
    if (Array.isArray(raw?.data?.hot)) {
        return raw.data.hot.flatMap((cat)=>cat?.items || []);
    }
    // trending/v2 + search/v2 + list shapes: items[] with subject nested
    if (Array.isArray(raw?.data?.items)) {
        return raw.data.items.map((it)=>it.subject || it);
    }
    // top-rec shape: items[] may be flat
    if (Array.isArray(raw?.data?.results)) {
        return raw.data.results.flatMap((r)=>r.subjects || [
                r
            ]);
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
        raw?.items
    ];
    for (const c of candidates){
        if (Array.isArray(c)) return c;
    }
    return [];
}
function parseSubjectType(t) {
    const n = Number(t);
    if (n === 2 || n === 4) return "tv";
    return "movie";
}
function parseGenres(s) {
    if (Array.isArray(s)) return s;
    if (typeof s === "string" && s) {
        return s.split(/[,/|]/).map((g)=>g.trim()).filter(Boolean);
    }
    return [];
}
function normalizeItems(raw) {
    const list = pickList(raw);
    return list.map((it)=>{
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
            imdbId: it.imdbId
        };
    }).filter((it)=>it.id && it.title);
}
function normalizeDetail(raw) {
    return raw?.data || raw?.subject || raw;
}
function normalizePlaySources(raw) {
    if (!raw) return [];
    // play-info returns: data.streams[]
    const streams = raw?.data?.streams;
    if (Array.isArray(streams)) return streams;
    // Fallback for other shapes
    const list = raw?.data?.playUrlList || raw?.data?.sources || raw?.data?.list || raw?.data?.resources || raw?.data || [];
    if (!Array.isArray(list)) return [];
    return list;
}
}),
"[project]/src/app/api/moviebox/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/moviebox.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/device.ts [app-route] (ecmascript)");
;
;
;
const runtime = "nodejs";
const dynamic = "force-dynamic";
const apiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
async function cached(key, fn, ttlMs = CACHE_TTL_MS) {
    const cached_entry = apiCache.get(key);
    if (cached_entry && Date.now() < cached_entry.expiresAt) {
        return cached_entry.data;
    }
    const data = await fn();
    apiCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
    });
    return data;
}
// === Pre-warm cache on server startup ===
// DISABLED on Vercel serverless — cookies()/headers() can't be called outside request scope.
// The first request will just be slower; cache fills from real requests.
// async function warmUpCache() { ... }
// warmUpCache();
// Extract raw subject list from any API response shape
function normalizeItemsRaw(raw) {
    if (!raw) return [];
    if (Array.isArray(raw?.data?.hot)) {
        return raw.data.hot.flatMap((cat)=>cat?.items || []);
    }
    if (Array.isArray(raw?.data?.items)) {
        return raw.data.items.map((it)=>it.subject || it);
    }
    if (Array.isArray(raw?.data?.results)) {
        return raw.data.results.flatMap((r)=>r.subjects || [
                r
            ]);
    }
    const candidates = [
        raw?.data?.list,
        raw?.data?.rows,
        raw?.data?.recommendList,
        raw?.data?.subjectList,
        raw?.data?.movies,
        raw?.data,
        raw?.list,
        raw?.results,
        raw?.items
    ];
    for (const c of candidates){
        if (Array.isArray(c)) return c;
    }
    return [];
}
// Trim the heavy fields we don't use client-side, to reduce payload size
function trimItems(items) {
    return items.map((it)=>({
            id: String(it.subjectId || it.id || ""),
            type: Number(it.subjectType) === 2 || Number(it.subjectType) === 4 ? "tv" : "movie",
            title: it.title || it.name || "Untitled",
            posterUrl: it.cover?.url || it.posterUrl,
            coverUrl: it.cover?.url,
            rating: Number(it.imdbRatingValue) || undefined,
            year: it.releaseDate ? String(it.releaseDate).slice(0, 4) : undefined,
            releaseDate: it.releaseDate,
            genre: it.genre,
            genres: typeof it.genre === "string" ? it.genre.split(/[,/|]/).map((g)=>g.trim()).filter(Boolean) : [],
            country: it.countryName,
            language: it.language,
            duration: it.duration,
            durationSeconds: it.durationSeconds,
            overview: (it.description || "").slice(0, 300)
        })).filter((it)=>it.id && it.title);
}
async function GET(req) {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "home";
    try {
        // === Identity & region endpoints ===
        if (action === "whoami") {
            const device = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDeviceFingerprint"])();
            const region = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getRegion"])();
            const realIp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUserRealIp"])();
            const effectiveIp = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBypassIp"])();
            const userId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getVisitorUserId"])();
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                device: {
                    device_id: device.device_id,
                    mac: device.mac,
                    imei: device.imei
                },
                region,
                regionInfo: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGIONS"][region] || __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGIONS"].AUTO,
                realIp: realIp || "(not available — running locally?)",
                effectiveIp,
                usingRealIp: region === "AUTO" && !!realIp,
                visitorUserId: userId,
                note: userId ? "You have a unique visitor account on MovieBox." : "Visit any title to acquire your visitor account."
            });
        }
        if (action === "regions") {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                regions: Object.entries(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGIONS"]).map(([code, info])=>({
                        code,
                        name: info.name,
                        timezone: info.timezone
                    }))
            });
        }
        if (action === "home") {
            const data = await cached("home", async ()=>{
                const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHomeData"])();
                const operating = raw?.data?.operatingList || [];
                const platformList = raw?.data?.platformList || [];
                // Build sections — trim items and slice to 10 per section to keep payload small
                const sections = operating.filter((op)=>op.type !== "BANNER" && op.subjects?.length > 0).map((op)=>({
                        title: op.title || op.type,
                        type: op.type,
                        items: trimItems(op.subjects).slice(0, 12)
                    })).filter((s)=>s.items.length > 0);
                // Pick top items across all sections for the hero carousel
                const heroItems = sections[0]?.items?.slice(0, 6) || [];
                return {
                    banners: heroItems,
                    sections,
                    platforms: platformList.map((p)=>({
                            name: p.name
                        }))
                };
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(data);
        }
        if (action === "h5-trending") {
            const page = Number(url.searchParams.get("page") || "0");
            const perPage = Number(url.searchParams.get("perPage") || "18");
            const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getH5Trending"])(page, perPage);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                items: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["normalizeItems"])({
                    data: {
                        items: raw?.data?.subjectList || []
                    }
                }),
                raw
            });
        }
        if (action === "bottom-tabs") {
            const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBottomTabs"])();
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                tabs: raw?.data?.bottomTabs || [],
                raw
            });
        }
        switch(action){
            case "hot":
                {
                    const items = await cached("hot", async ()=>trimItems(normalizeItemsRaw(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSearchRank"])())));
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items
                    });
                }
            case "top":
                {
                    const items = await cached("top", async ()=>trimItems(normalizeItemsRaw(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTopRec"])(20))));
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items
                    });
                }
            case "list":
                {
                    const category = url.searchParams.get("category") || "movie";
                    const page = Number(url.searchParams.get("page") || "1");
                    const size = Number(url.searchParams.get("size") || "20");
                    const result = await cached(`list:${category}:${page}:${size}`, async ()=>{
                        const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getList"])(category, page, size);
                        return {
                            items: trimItems(normalizeItemsRaw(raw)),
                            pager: raw?.data?.pager
                        };
                    });
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
                }
            case "trending":
                {
                    const category = url.searchParams.get("category") || "movie";
                    const page = Number(url.searchParams.get("page") || "1");
                    const size = Number(url.searchParams.get("size") || "20");
                    const result = await cached(`trending:${category}:${page}:${size}`, async ()=>{
                        const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTrending"])(category, page, size);
                        return {
                            items: trimItems(normalizeItemsRaw(raw)),
                            pager: raw?.data?.pager
                        };
                    });
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
                }
            case "search":
                {
                    const keyword = url.searchParams.get("keyword") || "";
                    if (!keyword.trim()) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items: []
                    });
                    // Search results change by keyword — cache per keyword for 2 min
                    const cacheKey = `search:${keyword}`;
                    const items = await cached(cacheKey, async ()=>trimItems(normalizeItemsRaw(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["searchAll"])(keyword))), 2 * 60 * 1000);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items
                    });
                }
            case "suggest":
                {
                    const keyword = url.searchParams.get("keyword") || "";
                    if (!keyword.trim()) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items: []
                    });
                    const items = await cached(`suggest:${keyword}`, async ()=>trimItems(normalizeItemsRaw(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSearchSuggestions"])(keyword))), 2 * 60 * 1000);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items
                    });
                }
            case "detail":
                {
                    const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
                    if (!subjectId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: "subjectId required"
                    }, {
                        status: 400
                    });
                    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSubjectDetail"])(subjectId);
                    const detail = raw?.data || raw?.subject || raw;
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        detail,
                        raw
                    });
                }
            case "play":
                {
                    const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
                    if (!subjectId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: "subjectId required"
                    }, {
                        status: 400
                    });
                    const se = url.searchParams.get("se") || undefined;
                    const ep = url.searchParams.get("ep") || undefined;
                    // Use the mobile API play-info endpoint (requires signed request + guest JWT)
                    // For TV shows, we need episodeId. We construct it from se/ep if provided.
                    // For movies, no episodeId needed.
                    let episodeId;
                    if (se && ep) {
                        // The mobile API expects episodeId as a string identifier
                        // Try passing the episode number directly
                        episodeId = ep;
                    }
                    const result = await cached(`play:${subjectId}:${se || ""}:${ep || ""}`, async ()=>{
                        const seNum = se ? Number(se) : undefined;
                        const epNum = ep ? Number(ep) : undefined;
                        const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getPlayInfo"])(subjectId, undefined, seNum, epNum);
                        return {
                            streams: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["normalizePlaySources"])(raw),
                            hasResource: (raw?.data?.streams?.length || 0) > 0
                        };
                    }, 30 * 60 * 1000);
                    // If mobile API returned no streams, try the h5-api as fallback
                    if (!result.streams || result.streams.length === 0) {
                        try {
                            const jwt = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getGuestJwt"])();
                            let h5Url = `https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/play?subjectId=${subjectId}`;
                            if (se) h5Url += `&se=${se}`;
                            if (ep) h5Url += `&ep=${ep}`;
                            const h5Res = await fetch(h5Url, {
                                headers: {
                                    Accept: "application/json",
                                    Cookie: `token=${jwt}; mb_token=${jwt}`,
                                    Origin: "https://movie-box.co"
                                }
                            });
                            const h5Raw = await h5Res.json();
                            const data = h5Raw?.data || {};
                            const h5Streams = [
                                ...data.streams || [],
                                ...data.hls || [],
                                ...data.dash || []
                            ];
                            if (h5Streams.length > 0) {
                                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                                    streams: h5Streams,
                                    hls: data.hls || [],
                                    dash: data.dash || [],
                                    hasResource: data.hasResource || true,
                                    source: "h5-api"
                                });
                            }
                        } catch  {
                        // h5-api also failed — fall through to return empty result
                        }
                    }
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        streams: result.streams || [],
                        hls: [],
                        dash: [],
                        hasResource: result.hasResource || false,
                        source: "mobile-api"
                    });
                }
            case "seasons":
                {
                    const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
                    if (!subjectId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: "subjectId required"
                    }, {
                        status: 400
                    });
                    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSeasonInfo"])(subjectId);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        seasons: raw?.data || raw,
                        raw
                    });
                }
            case "staff":
                {
                    const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
                    if (!subjectId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: "subjectId required"
                    }, {
                        status: 400
                    });
                    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStaffInfo"])(subjectId);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        staff: raw?.data || raw,
                        raw
                    });
                }
            case "recs":
                {
                    const subjectId = url.searchParams.get("subjectId") || url.searchParams.get("id");
                    if (!subjectId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: "subjectId required"
                    }, {
                        status: 400
                    });
                    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDetailRec"])(subjectId);
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        items: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$moviebox$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["normalizeItems"])(raw),
                        raw
                    });
                }
            default:
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "unknown action"
                }, {
                    status: 400
                });
        }
    } catch (e) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: e?.message || "request failed"
        }, {
            status: 500
        });
    }
}
async function POST(req) {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    try {
        if (action === "set-region") {
            const body = await req.json();
            const region = body?.region;
            if (!region || !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGIONS"][region]) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Invalid region. Use GET ?action=regions to see valid options."
                }, {
                    status: 400
                });
            }
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setRegion"])(region);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: true,
                region,
                regionInfo: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REGIONS"][region]
            });
        }
        if (action === "reset-identity") {
            const newDevice = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$device$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resetDeviceFingerprint"])();
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                ok: true,
                message: "Identity reset. You now have a new visitor account.",
                device: {
                    device_id: newDevice.device_id,
                    mac: newDevice.mac,
                    imei: newDevice.imei
                }
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "unknown action"
        }, {
            status: 400
        });
    } catch (e) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: e?.message || "request failed"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__68f28aa1._.js.map