/**
 * Dump full /subject-api/get response to find resourceId/postId fields
 */
import crypto from "crypto";
import * as fs from "fs";

const SECRET_RAW = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
const HOST = "https://api6.aoneroom.com";
const BASE_PATH = "/wefeed-mobile-bff";
const APP_KEY = "d3d3Lm1vdmllYm94b25saW5lLmNvbQ==";
const APP_VERSION = "3.0.05.0711.03";
const APP_ID = "1";

function md5(s: string) { return crypto.createHash("md5").update(s).digest("hex"); }
function hmacMd5B64(key: Buffer, data: string) { return crypto.createHmac("md5", key).update(data).digest("base64"); }
function reverseStr(s: string) { return s.split("").reverse().join(""); }
function sortQuery(q: Record<string, string>) {
  return Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join("&");
}

const key = Buffer.from(SECRET_RAW, "base64");
const CLIENT_INFO = JSON.stringify({
  appkey: APP_KEY, app_version: APP_VERSION, appid: APP_ID, device: "2", lang: "en",
  device_id: "a1b2c3d4e5f6g7h8", mac: "00:11:22:33:44:55", imei: "123456789012345",
});

async function call(path: string, query: Record<string, string>, method: "GET" | "POST", body: any, jwt?: string) {
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
  const xUser = res.headers.get("x-user");
  let newJwt: string | null = null;
  if (xUser) {
    try { newJwt = JSON.parse(xUser).token; } catch { newJwt = xUser; }
  }
  return { status: res.status, text, jwt: newJwt };
}

const commonQuery = { app_version: APP_VERSION, appid: APP_ID, appkey: APP_KEY, device: "2", lang: "en" };

// Get JWT
let jwt = (await call(`${BASE_PATH}/subject-api/trending/v2`, commonQuery, "POST", { category: "movie", page: 1, size: 3 })).jwt!;
console.log("JWT acquired");

// Try multiple trending items to find ones with play info
const trendRes = await call(`${BASE_PATH}/subject-api/trending/v2`, commonQuery, "POST", { category: "movie", page: 1, size: 30 });
if (trendRes.jwt) jwt = trendRes.jwt;
const trendData = JSON.parse(trendRes.text);
console.log(`Got ${trendData.data.items.length} trending items`);

// For each item, get detail and try play-info
let found = false;
for (const item of trendData.data.items.slice(0, 8)) {
  if (found) break;
  const subject = item.subject || item;
  const sid = subject.subjectId;
  const title = subject.title;

  console.log(`\n=== ${title} (subjectId=${sid}) ===`);

  // Get detail
  const detailRes = await call(`${BASE_PATH}/subject-api/get`, { ...commonQuery, subjectId: sid }, "GET", null, jwt);
  if (detailRes.jwt) jwt = detailRes.jwt;
  const detail = JSON.parse(detailRes.text);
  const d = detail.data;
  if (!d) { console.log("  No detail data"); continue; }

  // Print all keys
  console.log("  Detail keys:", Object.keys(d).join(", "));

  // Print relevant resource fields
  const resourceFields = ["resourceId", "postId", "resourceList", "resources", "resourcePositions", "playUrlList", "streams", "streamList", "videos"];
  for (const f of resourceFields) {
    if (d[f] !== undefined) {
      console.log(`  ${f}:`, JSON.stringify(d[f]).slice(0, 300));
    }
  }

  // Save full detail to file for first item
  if (!found) {
    fs.writeFileSync("/home/z/my-project/scripts/detail-sample.json", JSON.stringify(d, null, 2));
    console.log("  (saved full detail to scripts/detail-sample.json)");
  }

  // Try play-info
  const playRes = await call(`${BASE_PATH}/subject-api/play-info`, { ...commonQuery, subjectId: sid }, "GET", null, jwt);
  if (playRes.jwt) jwt = playRes.jwt;
  console.log(`  play-info: ${playRes.status} | ${playRes.text.slice(0, 400)}`);

  // If streams present, we found it!
  const play = JSON.parse(playRes.text);
  if (play?.data?.streams?.length > 0 || play?.data?.playUrlList?.length > 0) {
    found = true;
    console.log("\n=== 🎯 STREAMS FOUND! ===");
    console.log(JSON.stringify(play.data, null, 2).slice(0, 2000));
  }
}
