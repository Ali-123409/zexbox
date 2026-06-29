/**
 * Dump full responses from working endpoints to understand data shape
 */
import crypto from "crypto";
import * as fs from "fs";

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
    "X-Client-Info": JSON.stringify({ appkey: APP_KEY, app_version: APP_VERSION, appid: APP_ID, device: "2", lang: "en" }),
    "X-Client-Status": "1",
    "X-Forwarded-For": "102.89.23.1",
    "User-Agent": "okhttp/4.12.0",
  };
  if (method === "POST") headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: bodyStr || undefined });
  return res;
}

const commonQuery = { app_version: APP_VERSION, appid: APP_ID, appkey: APP_KEY, device: "2", lang: "en" };

const out: Record<string, any> = {};

// 1. search-rank/v2 — Hot Movies
console.log("=== search-rank/v2 ===");
const rankRes = await call(`${BASE_PATH}/subject-api/search-rank/v2`, commonQuery);
out["search-rank-v2"] = await rankRes.json();
console.log(JSON.stringify(out["search-rank-v2"], null, 2).slice(0, 2000));

// 2. /subject-api/list — movie list
console.log("\n=== /subject-api/list (category=movie) ===");
const listRes = await call(`${BASE_PATH}/subject-api/list`, commonQuery, "POST", { category: "movie", page: 1, size: 10 });
out["list-movie"] = await listRes.json();
console.log(JSON.stringify(out["list-movie"], null, 2).slice(0, 2000));

// 3. /subject-api/list — tv list
console.log("\n=== /subject-api/list (category=tv) ===");
const tvRes = await call(`${BASE_PATH}/subject-api/list`, commonQuery, "POST", { category: "tv", page: 1, size: 10 });
out["list-tv"] = await tvRes.json();
console.log(JSON.stringify(out["list-tv"], null, 2).slice(0, 2000));

// 4. /subject-api/search-suggest
console.log("\n=== /subject-api/search-suggest (keyword=ave) ===");
const suggestRes = await call(`${BASE_PATH}/subject-api/search-suggest`, { ...commonQuery, keyword: "ave" });
out["search-suggest"] = await suggestRes.json();
console.log(JSON.stringify(out["search-suggest"], null, 2).slice(0, 2000));

// 5. /subject-api/filter-items
console.log("\n=== /subject-api/filter-items ===");
const filterRes = await call(`${BASE_PATH}/subject-api/filter-items`, commonQuery);
out["filter-items"] = await filterRes.json();
console.log(JSON.stringify(out["filter-items"], null, 2).slice(0, 1500));

// Save full output
fs.writeFileSync("/home/z/my-project/scripts/api-dump.json", JSON.stringify(out, null, 2));
console.log("\n=== Full dump saved to /home/z/my-project/scripts/api-dump.json ===");
