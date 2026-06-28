/**
 * Find the visitor registration endpoint + try fetching detail/play-info
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
const ts = Date.now().toString();
const clientToken = `${ts},${md5(reverseStr(ts))}`;
const accept = "*/*";

async function call(path: string, query: Record<string, string> = {}, method: "GET" | "POST" = "GET", body?: any) {
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodyMd5 = bodyStr ? md5(bodyStr.slice(0, 102400)) : "";
  const sortedQuery = sortQuery(query);
  const pathWithQuery = sortedQuery ? `${path}?${sortedQuery}` : path;
  const contentLength = bodyStr ? Buffer.byteLength(bodyStr).toString() : "";
  const contentType = method === "POST" ? "application/json" : "";

  const signString = [method, accept, contentType, contentLength, ts, bodyMd5, pathWithQuery].join("\n");
  const sig = hmacMd5B64(key, signString);

  const url = new URL(HOST + path);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    Accept: accept,
    "x-tr-signature": `${ts}|2|${sig}`,
    "X-Client-Token": clientToken,
    "X-Client-Info": JSON.stringify({
      appkey: APP_KEY,
      app_version: APP_VERSION,
      appid: APP_ID,
      device: "2",
      lang: "en",
    }),
    "X-Client-Status": "1",
    "X-Forwarded-For": "102.89.23.1",
    "User-Agent": "okhttp/4.12.0",
  };
  if (method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, { method, headers, body: bodyStr || undefined });
  return res;
}

async function tryEndpoint(label: string, fn: () => Promise<Response>) {
  try {
    const res = await fn();
    const xUser = res.headers.get("x-user") || res.headers.get("X-User");
    const text = await res.text();
    const allHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (allHeaders[k] = v));
    const headerKeys = Object.keys(allHeaders).join(",");
    console.log(`${label.padEnd(45)} | ${res.status} | X-User=${xUser ? "YES" : "no"} | body=${text.slice(0, 200)}`);
    if (xUser) {
      console.log("  >>> JWT FOUND:", xUser.slice(0, 100));
      console.log("  >>> All headers:", JSON.stringify(allHeaders, null, 2));
    }
    return { res, xUser, text, allHeaders };
  } catch (e: any) {
    console.log(`${label.padEnd(45)} | ERROR: ${e?.message}`);
    return null;
  }
}

const commonQuery = {
  app_version: APP_VERSION,
  appid: APP_ID,
  appkey: APP_KEY,
  device: "2",
  lang: "en",
};

// Try visitor-related endpoints
console.log("=== Visitor endpoint candidates ===");
await tryEndpoint("POST /user-api/visitor-register", () => call(`${BASE_PATH}/user-api/visitor-register`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));
await tryEndpoint("POST /user-api/visitor", () => call(`${BASE_PATH}/user-api/visitor`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));
await tryEndpoint("POST /user-api/auto-login", () => call(`${BASE_PATH}/user-api/auto-login`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));
await tryEndpoint("POST /user-api/guest-login", () => call(`${BASE_PATH}/user-api/guest-login`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));
await tryEndpoint("POST /user-api/anonymous", () => call(`${BASE_PATH}/user-api/anonymous`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));
await tryEndpoint("GET  /user-api/visitor", () => call(`${BASE_PATH}/user-api/visitor`, commonQuery, "GET"));
await tryEndpoint("POST /user-api/device-login", () => call(`${BASE_PATH}/user-api/device-login`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));
await tryEndpoint("POST /user-api/init", () => call(`${BASE_PATH}/user-api/init`, commonQuery, "POST", {}));
await tryEndpoint("POST /user-api/quick-login", () => call(`${BASE_PATH}/user-api/quick-login`, commonQuery, "POST", { device_id: "a1b2c3d4e5f6g7h8" }));

// Try without auth endpoints
console.log("\n=== Content endpoints (should work) ===");
await tryEndpoint("POST /subject-api/genre-top", () => call(`${BASE_PATH}/subject-api/genre-top`, commonQuery, "POST", { genre: "Action", size: 5 }));
await tryEndpoint("POST /subject-api/list", () => call(`${BASE_PATH}/subject-api/list`, commonQuery, "POST", { category: "movie", page: 1, size: 5 }));
await tryEndpoint("GET  /subject-api/search-rank/v2", () => call(`${BASE_PATH}/subject-api/search-rank/v2`, commonQuery, "GET"));
await tryEndpoint("GET  /subject-api/filter-items", () => call(`${BASE_PATH}/subject-api/filter-items`, commonQuery, "GET"));
await tryEndpoint("GET  /subject-api/bottom-tab", () => call(`${BASE_PATH}/subject-api/bottom-tab`, commonQuery, "GET"));
await tryEndpoint("GET  /subject-api/get (no id)", () => call(`${BASE_PATH}/subject-api/get`, { ...commonQuery, id: "401620427975586776" }, "GET"));

// app config
console.log("\n=== App config endpoints ===");
await tryEndpoint("GET  /app/js-config", () => call(`${BASE_PATH}/app/js-config`, commonQuery, "GET"));
await tryEndpoint("GET  /app/config", () => call(`${BASE_PATH}/app/config`, commonQuery, "GET"));
await tryEndpoint("GET  /community/trending-entrance", () => call(`${BASE_PATH}/community/trending-entrance`, commonQuery, "GET"));
