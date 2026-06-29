/**
 * Debug: probe /app/config and inspect all response headers
 */
import crypto from "crypto";

const PROD_SECRET_RAW = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
const API_HOSTS = [
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
  return Object.keys(q).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`).join("&");
}

const ts = Date.now().toString();
const clientToken = `${ts},${md5(reverseStr(ts))}`;
const path = `${BASE_PATH}/app/config`;
const query: Record<string, string> = {
  appkey: APP_KEY,
  app_version: APP_VERSION,
  appid: APP_ID,
  device: "2",
  lang: "en",
};
const body = "";
const accept = "application/json";
const contentType = "application/json";

const bodyMd5 = body ? md5(body.slice(0, 102400)) : "";
const sortedQuery = sortQuery(query);
const pathWithQuery = sortedQuery ? `${path}?${sortedQuery}` : path;
const contentLength = body ? Buffer.byteLength(body).toString() : "0";
const signString = [ "GET", accept, contentType, contentLength, ts, bodyMd5, pathWithQuery ].join("\n");

// Try the raw secret directly as HMAC key (NOT base64-decoded)
const sigRaw = hmacMd5B64(Buffer.from(PROD_SECRET_RAW, "utf8"), signString);
// Also try base64-decoded
const sigB64 = hmacMd5B64(Buffer.from(PROD_SECRET_RAW, "base64"), signString);

console.log("=== Signing String ===");
console.log(JSON.stringify(signString));
console.log("\n=== Signatures ===");
console.log("Raw key sig:", sigRaw);
console.log("B64-decoded sig:", sigB64);

for (const host of API_HOSTS) {
  console.log(`\n=== Trying ${host} ===`);
  const url = new URL(host + path);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

  for (const [label, sig] of [["raw", sigRaw], ["b64", sigB64]]) {
    console.log(`\n--- sig variant: ${label} ---`);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: accept,
          "Content-Type": contentType,
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
          Host: url.host,
        },
      });
      console.log("Status:", res.status);
      console.log("All headers:");
      res.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value.slice(0, 200)}`);
      });
      const text = await res.text();
      console.log("Body (first 500 chars):", text.slice(0, 500));
    } catch (e: any) {
      console.error("Error:", e?.message);
    }
  }
}
