/**
 * Confirm working signing + check for X-User JWT
 */
import crypto from "crypto";

const SECRET_RAW = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
const HOSTS = [
  "https://api6.aoneroom.com",
  "https://api3.aoneroom.com",
  "https://api4.aoneroom.com",
];
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

async function call(host: string, path: string, query: Record<string, string>, method: "GET" | "POST" = "GET", body?: any) {
  const bodyStr = body ? JSON.stringify(body) : "";
  const bodyMd5 = bodyStr ? md5(bodyStr.slice(0, 102400)) : "";
  const sortedQuery = sortQuery(query);
  const pathWithQuery = sortedQuery ? `${path}?${sortedQuery}` : path;
  const contentLength = bodyStr ? Buffer.byteLength(bodyStr).toString() : "";

  // For GET: no Content-Type header, no Content-Length
  // For POST: include both
  const contentType = method === "POST" ? "application/json" : "";

  const signString = [method, accept, contentType, contentLength, ts, bodyMd5, pathWithQuery].join("\n");
  const sig = hmacMd5B64(key, signString);

  const url = new URL(host + path);
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
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }
  if (bodyStr) headers["Content-Length"] = contentLength;

  const res = await fetch(url, { method, headers, body: bodyStr || undefined });
  return res;
}

async function dumpHeaders(res: Response, label: string) {
  console.log(`\n=== ${label} ===`);
  console.log("Status:", res.status);
  console.log("Response headers:");
  res.headers.forEach((v, k) => console.log(`  ${k}: ${v.slice(0, 150)}`));
}

// Test 1: app/config (basic guest auth)
for (const host of HOSTS) {
  try {
    const res = await call(host, `${BASE_PATH}/app/config`, {
      app_version: APP_VERSION,
      appid: APP_ID,
      appkey: APP_KEY,
      device: "2",
      lang: "en",
    });
    await dumpHeaders(res, `${host} /app/config`);
    const text = await res.text();
    console.log("Body (first 300 chars):", text.slice(0, 300));
    if (res.status === 200) break;
  } catch (e: any) {
    console.error(`${host} error:`, e?.message);
  }
}
