/**
 * Try various endpoints to find the one that returns X-User JWT
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
    console.log(`${label.padEnd(40)} | status=${res.status} | X-User=${xUser ? "YES ("+xUser.slice(0,40)+"...)" : "no"} | body=${text.slice(0, 100)}`);
    return { res, xUser, text };
  } catch (e: any) {
    console.log(`${label.padEnd(40)} | ERROR: ${e?.message}`);
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

// Try many endpoints
await tryEndpoint("GET /subject-api/trending/v2", () => call(`${BASE_PATH}/subject-api/trending/v2`, commonQuery, "POST", { category: "movie", page: 1, size: 5 }));

await tryEndpoint("POST /subject-api/top-rec", () => call(`${BASE_PATH}/subject-api/top-rec`, commonQuery, "POST", { size: 5 }));

await tryEndpoint("GET /subject-api/search-suggest", () => call(`${BASE_PATH}/subject-api/search-suggest`, { ...commonQuery, keyword: "ave" }, "GET"));

await tryEndpoint("POST /subject-api/search/v2", () => call(`${BASE_PATH}/subject-api/search/v2`, commonQuery, "POST", { keyword: "avengers", page: 1, size: 5 }));

await tryEndpoint("GET /user-api/info", () => call(`${BASE_PATH}/user-api/info`, commonQuery, "GET"));

await tryEndpoint("GET /user-api/profile", () => call(`${BASE_PATH}/user-api/profile`, commonQuery, "GET"));

await tryEndpoint("POST /user-api/login (empty)", () => call(`${BASE_PATH}/user-api/login`, commonQuery, "POST", {}));

await tryEndpoint("POST /user-api/register (empty)", () => call(`${BASE_PATH}/user-api/register`, commonQuery, "POST", {}));

await tryEndpoint("POST /user-api/third-login (google)", () => call(`${BASE_PATH}/user-api/third-login`, commonQuery, "POST", { platform: "google", token: "guest" }));

await tryEndpoint("GET /subject-api/see-list-v2", () => call(`${BASE_PATH}/subject-api/see-list-v2`, commonQuery, "GET"));

await tryEndpoint("GET /tab-operating", () => call(`${BASE_PATH}/tab-operating`, commonQuery, "GET"));

await tryEndpoint("GET /tab/ranking-list", () => call(`${BASE_PATH}/tab/ranking-list`, commonQuery, "GET"));

await tryEndpoint("GET /activity/check-in-info", () => call(`${BASE_PATH}/activity/check-in-info`, commonQuery, "GET"));

await tryEndpoint("GET /app/check-update", () => call(`${BASE_PATH}/app/check-update`, commonQuery, "GET"));

await tryEndpoint("GET /ad/config", () => call(`${BASE_PATH}/ad/config`, commonQuery, "GET"));

await tryEndpoint("POST /activity/check-in", () => call(`${BASE_PATH}/activity/check-in`, commonQuery, "POST", {}));
