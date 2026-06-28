/**
 * Find correct param name for /subject-api/get and /subject-api/play-info
 */
import crypto from "crypto";

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

// Get a fresh JWT
const trendRes = await call(`${BASE_PATH}/subject-api/trending/v2`, commonQuery, "POST", { category: "movie", page: 1, size: 3 });
let jwt = trendRes.jwt!;
console.log("JWT acquired");

// Get the real trending data to extract a real subjectId
const trendData = JSON.parse(trendRes.text);
const sampleItem = trendData.data.items[0];
const sampleSubject = sampleItem.subject || sampleItem;
const testId = sampleSubject.subjectId;
console.log("Testing with subjectId:", testId, "title:", sampleSubject.title);

// Try /subject-api/get with different param names
console.log("\n=== /subject-api/get variations ===");
const getVariations: Record<string, string>[] = [
  { id: testId },
  { subjectId: testId },
  { subject_id: testId },
  { sid: testId },
  { subjectID: testId },
  { Id: testId },
  { ID: testId },
];
for (const v of getVariations) {
  const r = await call(`${BASE_PATH}/subject-api/get`, { ...commonQuery, ...v }, "GET", null, jwt);
  if (r.jwt) jwt = r.jwt;
  console.log(`  params=${JSON.stringify(v)} | ${r.status} | ${r.text.slice(0, 200)}`);
}

// Try POST /subject-api/get with body
console.log("\n=== POST /subject-api/get with body ===");
const postBodies = [
  { id: testId },
  { subjectId: testId },
  { subject_id: testId },
  { id: Number(testId) },
];
for (const b of postBodies) {
  const r = await call(`${BASE_PATH}/subject-api/get`, commonQuery, "POST", b, jwt);
  if (r.jwt) jwt = r.jwt;
  console.log(`  body=${JSON.stringify(b)} | ${r.status} | ${r.text.slice(0, 300)}`);
}

// Same for /subject-api/play-info
console.log("\n=== /subject-api/play-info variations ===");
for (const v of getVariations) {
  const r = await call(`${BASE_PATH}/subject-api/play-info`, { ...commonQuery, ...v }, "GET", null, jwt);
  if (r.jwt) jwt = r.jwt;
  console.log(`  params=${JSON.stringify(v)} | ${r.status} | ${r.text.slice(0, 300)}`);
}

// POST play-info
console.log("\n=== POST /subject-api/play-info with body ===");
for (const b of postBodies) {
  const r = await call(`${BASE_PATH}/subject-api/play-info`, commonQuery, "POST", b, jwt);
  if (r.jwt) jwt = r.jwt;
  console.log(`  body=${JSON.stringify(b)} | ${r.status} | ${r.text.slice(0, 500)}`);
}

// Try resource-position with different params
console.log("\n=== /subject-api/resource-position variations ===");
for (const v of getVariations) {
  const r = await call(`${BASE_PATH}/subject-api/resource-position`, { ...commonQuery, ...v }, "GET", null, jwt);
  if (r.jwt) jwt = r.jwt;
  console.log(`  params=${JSON.stringify(v)} | ${r.status} | ${r.text.slice(0, 300)}`);
}
