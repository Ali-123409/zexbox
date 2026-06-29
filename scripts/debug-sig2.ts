/**
 * More aggressive signature debugging
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

const ts = Date.now().toString();
const clientToken = `${ts},${md5(reverseStr(ts))}`;
const path = `${BASE_PATH}/app/config`;

// Sorted query params (alphabetical by key)
const sortedQueryRaw = "app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ==&device=2&lang=en";

const keyB64 = Buffer.from(SECRET_RAW, "base64");
const keyRaw = Buffer.from(SECRET_RAW, "utf8");

// Variations of the sign string (varying the empty fields)
const signStringVariations = [
  // v1: All "" for empty fields, content-length="0" when empty body
  {
    label: "cl=0",
    str: ["GET", "application/json", "application/json", "0", ts, "", `${path}?${sortedQueryRaw}`].join("\n"),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  },
  // v2: Content-Length="" (no content-length), content-type=""
  {
    label: "cl-empty-ct-empty",
    str: ["GET", "", "", "", ts, "", `${path}?${sortedQueryRaw}`].join("\n"),
    headers: {},
  },
  // v3: Accept=*/*, no content-type
  {
    label: "accept=*/*",
    str: ["GET", "*/*", "", "", ts, "", `${path}?${sortedQueryRaw}`].join("\n"),
    headers: { Accept: "*/*" },
  },
  // v4: Content-Type=application/json but content-length=""
  {
    label: "ct-only",
    str: ["GET", "application/json", "application/json", "", ts, "", `${path}?${sortedQueryRaw}`].join("\n"),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  },
  // v5: Just the path (no query)
  {
    label: "no-query",
    str: ["GET", "application/json", "application/json", "0", ts, "", path].join("\n"),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  },
  // v6: Use only the path AFTER /wefeed-mobile-bff
  {
    label: "short-path",
    str: ["GET", "application/json", "application/json", "0", ts, "", `/app/config?${sortedQueryRaw}`].join("\n"),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
  },
];

for (const v of signStringVariations) {
  for (const [klabel, key] of [["raw", keyRaw], ["b64", keyB64]] as const) {
    const sig = hmacMd5B64(key, v.str);
    const url = `${HOST}${path}?app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ%3D%3D&device=2&lang=en`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...v.headers,
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
        },
      });
      const text = await res.text();
      console.log(`v=${v.label.padEnd(20)} key=${klabel.padEnd(3)} => ${res.status} ${text.slice(0, 100)}`);
    } catch (e: any) {
      console.error(`v=${v.label} key=${klabel} Error:`, e?.message);
    }
  }
}
