/**
 * Test all auth-gated endpoints with the new visitor JWT
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
const CLIENT_INFO = JSON.stringify({
  appkey: APP_KEY,
  app_version: APP_VERSION,
  appid: APP_ID,
  device: "2",
  lang: "en",
  device_id: "a1b2c3d4e5f6g7h8",
  mac: "00:11:22:33:44:55",
  imei: "123456789012345",
});

async function call(
  path: string,
  query: Record<string, string>,
  method: "GET" | "POST",
  body: any,
  jwt?: string
): Promise<{ status: number; text: string; jwt: string | null }> {
  const ts = Date.now().toString();
  const token = `${ts},${md5(reverseStr(ts))}`;
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
    "X-Client-Info": CLIENT_INFO,
    "X-Client-Status": "1",
    "X-Forwarded-For": "102.89.23.1",
    "User-Agent": "okhttp/4.12.0",
  };
  if (method === "POST") headers["Content-Type"] = "application/json";
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

  const res = await fetch(url, { method, headers, body: bodyStr || undefined });
  const text = await res.text();

  // Capture refreshed JWT if any
  const xUserRaw = res.headers.get("x-user") || res.headers.get("X-User");
  let newJwt: string | null = null;
  if (xUserRaw) {
    try {
      const parsed = JSON.parse(xUserRaw);
      newJwt = parsed.token || parsed.jwt || parsed;
    } catch {
      newJwt = xUserRaw;
    }
  }

  return { status: res.status, text, jwt: newJwt };
}

const commonQuery = {
  app_version: APP_VERSION,
  appid: APP_ID,
  appkey: APP_KEY,
  device: "2",
  lang: "en",
};

// Step 1: Get JWT from trending endpoint
console.log("=== Step 1: Acquire visitor JWT ===");
const trendRes = await call(
  `${BASE_PATH}/subject-api/trending/v2`,
  commonQuery,
  "POST",
  { category: "movie", page: 1, size: 3 }
);
console.log("Status:", trendRes.status);
let jwt = trendRes.jwt;
console.log("JWT:", jwt ? `${jwt.slice(0, 60)}... (${jwt.length} chars)` : "none");
console.log("Body preview:", trendRes.text.slice(0, 300));

if (!jwt) {
  console.error("FAILED to get JWT — aborting");
  process.exit(1);
}

// Step 2: Test all previously-auth-gated endpoints with the JWT
console.log("\n=== Step 2: Test all auth-gated endpoints with JWT ===");
const tests: { label: string; path: string; method: "GET" | "POST"; query?: Record<string, string>; body?: any }[] = [
  { label: "subject-get", path: `${BASE_PATH}/subject-api/get`, method: "GET", query: { id: "7808991045882365944" } },
  { label: "play-info", path: `${BASE_PATH}/subject-api/play-info`, method: "GET", query: { id: "7808991045882365944" } },
  { label: "search-v2", path: `${BASE_PATH}/subject-api/search/v2`, method: "POST", body: { keyword: "avengers", page: 1, size: 5 } },
  { label: "bottom-tab", path: `${BASE_PATH}/subject-api/bottom-tab`, method: "GET" },
  { label: "ranking-list", path: `${BASE_PATH}/tab/ranking-list`, method: "GET" },
  { label: "season-info", path: `${BASE_PATH}/subject-api/season-info`, method: "GET", query: { id: "7808991045882365944" } },
  { label: "staff-info", path: `${BASE_PATH}/subject-api/staff-info`, method: "GET", query: { id: "7808991045882365944" } },
  { label: "see-list-v2", path: `${BASE_PATH}/subject-api/see-list-v2`, method: "GET" },
  { label: "detail-rec", path: `${BASE_PATH}/subject-api/detail-rec`, method: "POST", body: { id: 7808991045882365944, size: 5 } },
  { label: "resource-position", path: `${BASE_PATH}/subject-api/resource-position`, method: "GET", query: { id: "7808991045882365944" } },
];

for (const t of tests) {
  const query = { ...commonQuery, ...(t.query || {}) };
  const r = await call(t.path, query, t.method, t.body, jwt);
  if (r.jwt) jwt = r.jwt; // refresh
  console.log(`\n--- ${t.label} ---`);
  console.log(`Status: ${r.status}`);
  console.log(`Body (first 800 chars): ${r.text.slice(0, 800)}`);
}
