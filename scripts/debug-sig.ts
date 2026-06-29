/**
 * Debug signature variations
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

// Query variations to try
const queryVariations = [
  // Variation 1: URL-encoded values (current)
  {
    label: "url-encoded",
    queryString: "app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ%3D%3D&device=2&lang=en",
    urlQuery: "app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ%3D%3D&device=2&lang=en",
  },
  // Variation 2: NOT URL-encoded (raw == in appkey)
  {
    label: "raw-not-encoded",
    queryString: "app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ==&device=2&lang=en",
    urlQuery: "app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ%3D%3D&device=2&lang=en",
  },
  // Variation 3: Different sort order (alphabetical by key ASCII)
  {
    label: "alphabetical",
    queryString: "appid=1&app_version=3.0.05.0711.03&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ==&device=2&lang=en",
    urlQuery: "app_version=3.0.05.0711.03&appid=1&appkey=d3d3Lm1vdmllYm94b25saW5lLmNvbQ%3D%3D&device=2&lang=en",
  },
];

const keyVariants = [
  { label: "raw-utf8", key: Buffer.from(SECRET_RAW, "utf8") },
  { label: "b64-decoded", key: Buffer.from(SECRET_RAW, "base64") },
];

const accept = "application/json";
const contentType = "application/json";

for (const qv of queryVariations) {
  for (const kv of keyVariants) {
    const pathWithQuery = `${path}?${qv.queryString}`;
    const signString = ["GET", accept, contentType, "0", ts, "", pathWithQuery].join("\n");
    const sig = hmacMd5B64(kv.key, signString);

    console.log(`\n=== qv=${qv.label} key=${kv.label} ===`);
    console.log("Sign string:", JSON.stringify(signString));
    console.log("Signature:", sig);

    const url = `${HOST}${path}?${qv.urlQuery}`;
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
        },
      });
      const text = await res.text();
      console.log(`Status: ${res.status} | Body: ${text.slice(0, 200)}`);
    } catch (e: any) {
      console.error("Error:", e?.message);
    }
  }
}
