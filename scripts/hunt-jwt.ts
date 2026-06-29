/**
 * Comprehensive X-User JWT hunt
 * Try every variation to find what triggers the server to return the guest JWT
 */
import crypto from "crypto";

const SECRET_RAW = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
const HOST = "https://api6.aoneroom.com";
const BASE_PATH = "/wefeed-mobile-bff";
const APP_KEY = "d3d3Lm1vdmllYm94b25saW5lLmNvbQ==";
const APP_VERSION = "3.0.05.0711.03";
const APP_ID = "1";

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}
function hmacMd5B64(key: Buffer, data: string) {
  return crypto.createHmac("md5", key).update(data).digest("base64");
}
function reverseStr(s: string) {
  return s.split("").reverse().join("");
}
function sortQuery(q: Record<string, string>) {
  return Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join("&");
}

const key = Buffer.from(SECRET_RAW, "base64");

// Try TWO timestamp formats: milliseconds AND seconds
const tsMs = Date.now().toString();
const tsS = Math.floor(Date.now() / 1000).toString();

// X-Client-Token variations
const tokenVariations = [
  { label: "ms", ts: tsMs, token: `${tsMs},${md5(reverseStr(tsMs))}` },
  { label: "seconds", ts: tsS, token: `${tsS},${md5(reverseStr(tsS))}` },
];

// X-Client-Info variations
const clientInfoVariations = [
  // Minimal
  {
    label: "minimal",
    info: { appkey: APP_KEY, app_version: APP_VERSION, appid: APP_ID, device: "2", lang: "en" },
  },
  // With device_id
  {
    label: "with-device-id",
    info: {
      appkey: APP_KEY,
      app_version: APP_VERSION,
      appid: APP_ID,
      device: "2",
      lang: "en",
      device_id: "a1b2c3d4e5f6g7h8",
      mac: "00:11:22:33:44:55",
      imei: "123456789012345",
    },
  },
  // Empty
  { label: "empty", info: {} },
];

async function call(
  path: string,
  query: Record<string, string>,
  method: "GET" | "POST",
  body: any,
  ts: string,
  token: string,
  clientInfo: any,
  extraHeaders: Record<string, string> = {}
) {
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodyMd5 = bodyStr ? md5(bodyStr.slice(0, 102400)) : "";
  const sortedQuery = sortQuery(query);
  const pathWithQuery = sortedQuery ? `${path}?${sortedQuery}` : path;
  const contentLength = bodyStr ? Buffer.byteLength(bodyStr).toString() : "";
  const contentType = method === "POST" ? "application/json" : "";
  const signString = [method, "*/*", contentType, contentLength, ts, bodyMd5, pathWithQuery].join("\n");
  const sig = hmacMd5B64(key, signString);

  const url = new URL(HOST + path);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    Accept: "*/*",
    "x-tr-signature": `${ts}|2|${sig}`,
    "X-Client-Token": token,
    "X-Client-Info": JSON.stringify(clientInfo),
    "X-Client-Status": "1",
    "X-Forwarded-For": "102.89.23.1",
    "User-Agent": "okhttp/4.12.0",
    ...extraHeaders,
  };
  if (method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, { method, headers, body: bodyStr || undefined });
  return res;
}

function checkJwt(res: Response): string | null {
  // Check every possible JWT header name (case-insensitive)
  const jwtHeaderNames = [
    "x-user", "X-User", "x-user-token", "X-User-Token",
    "x-tr-user", "X-Tr-User", "x-visitor", "X-Visitor",
    "x-visitor-token", "X-Visitor-Token", "x-guest", "X-Guest",
    "x-auth-token", "X-Auth-Token", "x-jwt", "X-Jwt",
    "authorization", "Authorization", "x-token", "X-Token",
    "x-tr-token", "X-Tr-Token", "set-cookie", "Set-Cookie",
  ];
  for (const name of jwtHeaderNames) {
    const v = res.headers.get(name);
    if (v && v.length > 20) return `${name}: ${v.slice(0, 80)}...`;
  }
  // Also dump all headers to spot anything JWT-like
  const all: string[] = [];
  res.headers.forEach((v, k) => {
    if (v.length > 30 && (k.toLowerCase().includes("user") || k.toLowerCase().includes("token") || k.toLowerCase().includes("auth") || k.toLowerCase().includes("visitor") || k.toLowerCase().includes("guest") || k.toLowerCase().includes("jwt"))) {
      all.push(`${k}=${v.slice(0, 80)}`);
    }
  });
  if (all.length > 0) return "FOUND: " + all.join(" | ");
  return null;
}

const commonQuery = {
  app_version: APP_VERSION,
  appid: APP_ID,
  appkey: APP_KEY,
  device: "2",
  lang: "en",
};

// Endpoints to try — focus on ones that said "USER_NEED_VISITOR" or "miss token"
const endpoints: { label: string; path: string; method: "GET" | "POST"; query?: Record<string, string>; body?: any }[] = [
  // Previously returned USER_NEED_VISITOR — perfect for testing visitor creation
  { label: "trending-v2", path: `${BASE_PATH}/subject-api/trending/v2`, method: "POST", body: { category: "movie", page: 1, size: 3 } },
  // Previously returned "miss token"
  { label: "search-v2", path: `${BASE_PATH}/subject-api/search/v2`, method: "POST", body: { keyword: "avengers", page: 1, size: 3 } },
  { label: "subject-get", path: `${BASE_PATH}/subject-api/get`, method: "GET", query: { id: "7808991045882365944" } },
  { label: "play-info", path: `${BASE_PATH}/subject-api/play-info`, method: "GET", query: { id: "7808991045882365944" } },
  // Visitor-related guesses
  { label: "user-info", path: `${BASE_PATH}/user-api/info`, method: "GET" },
  { label: "user-profile", path: `${BASE_PATH}/user-api/profile`, method: "GET" },
  { label: "user-profile-v2", path: `${BASE_PATH}/user-api/profile/v2`, method: "GET" },
  // Bottom tab needs auth
  { label: "bottom-tab", path: `${BASE_PATH}/subject-api/bottom-tab`, method: "GET" },
  { label: "ranking-list", path: `${BASE_PATH}/tab/ranking-list`, method: "GET" },
];

let found = false;
for (const ep of endpoints) {
  if (found) break;
  for (const tv of tokenVariations) {
    if (found) break;
    for (const cv of clientInfoVariations) {
      if (found) break;
      const query = { ...commonQuery, ...(ep.query || {}) };
      try {
        const res = await call(ep.path, query, ep.method, ep.body, tv.ts, tv.token, cv.info);
        const jwt = checkJwt(res);
        const text = await res.text();
        const marker = jwt ? "🎯🎯🎯" : "      ";
        console.log(`${marker} ep=${ep.label.padEnd(18)} tok=${tv.label.padEnd(7)} info=${cv.label.padEnd(15)} | ${res.status} | jwt=${jwt ? jwt : "no"} | body=${text.slice(0, 120)}`);
        if (jwt) {
          console.log("\n=== JWT FOUND! Full details: ===");
          console.log("Endpoint:", ep.path);
          console.log("Token variation:", tv.label, "→", tv.token);
          console.log("Client info:", cv.label, "→", JSON.stringify(cv.info));
          console.log("All response headers:");
          res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
          found = true;
        }
      } catch (e: any) {
        console.log(`      ep=${ep.label.padEnd(18)} tok=${tv.label.padEnd(7)} info=${cv.label.padEnd(15)} | ERROR: ${e?.message}`);
      }
    }
  }
}

if (!found) {
  console.log("\n=== No JWT found in any combination. Dumping ALL headers from a sample call. ===");
  // Pick one endpoint and dump everything
  const res = await call(
    `${BASE_PATH}/subject-api/trending/v2`,
    commonQuery,
    "POST",
    { category: "movie", page: 1, size: 3 },
    tsMs,
    `${tsMs},${md5(reverseStr(tsMs))}`,
    { appkey: APP_KEY, app_version: APP_VERSION, appid: APP_ID, device: "2", lang: "en" }
  );
  console.log("Status:", res.status);
  console.log("ALL response headers:");
  res.headers.forEach((v, k) => console.log(`  ${k}: ${v.slice(0, 200)}`));
  console.log("\nBody:", (await res.text()).slice(0, 500));
}
