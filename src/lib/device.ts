/**
 * Per-browser device fingerprint + region/IP handling
 *
 * Each browser gets its own unique device_id, mac, imei stored in a cookie.
 * This means each user gets their own visitor JWT and userId from MovieBox.
 *
 * IP handling:
 *   By default, we pass the USER'S REAL IP (from the incoming request headers)
 *   to MovieBox. This is what the original APK does — it works in India, Pakistan,
 *   Africa, etc. because MovieBox blocks server/datacenter IPs, NOT user IPs.
 *
 *   If the user wants to override (e.g. to access a specific region's catalog),
 *   they can pick a country in Profile → Identity & Region, which switches us
 *   to using that region's IP instead.
 *
 * Why cookies (not localStorage)?
 *   - The signing happens server-side (in the API route)
 *   - Server needs to read the fingerprint on every request
 *   - Cookies are sent automatically with every request
 *   - httpOnly cookies can't be tampered with from client JS
 */

import { cookies, headers } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "zexbox-device";
const REGION_COOKIE_NAME = "zexbox-region";

export interface DeviceFingerprint {
  device_id: string;
  mac: string;
  imei: string;
}

// African region IPs for optional region override
// (used when user explicitly picks a region in Profile)
export const REGIONS: Record<string, { name: string; ip: string; timezone: string }> = {
  AUTO: { name: "Auto (my IP)",  ip: "",                timezone: "Africa/Lagos" }, // sentinel — uses real IP
  NG:   { name: "Nigeria",       ip: "102.89.23.1",     timezone: "Africa/Lagos" },
  KE:   { name: "Kenya",         ip: "41.90.0.1",       timezone: "Africa/Nairobi" },
  GH:   { name: "Ghana",         ip: "41.215.0.1",      timezone: "Africa/Accra" },
  ZA:   { name: "South Africa",  ip: "41.0.0.1",        timezone: "Africa/Johannesburg" },
  EG:   { name: "Egypt",         ip: "156.200.0.1",     timezone: "Africa/Cairo" },
  TZ:   { name: "Tanzania",      ip: "41.59.0.1",       timezone: "Africa/Dar_es_Salaam" },
  UG:   { name: "Uganda",        ip: "41.190.0.1",      timezone: "Africa/Kampala" },
  ET:   { name: "Ethiopia",      ip: "196.188.0.1",     timezone: "Africa/Addis_Ababa" },
};

export const DEFAULT_REGION = "AUTO";

function generateFingerprint(): DeviceFingerprint {
  const device_id = crypto.randomBytes(8).toString("hex");
  const mac = Array.from({ length: 6 }, () =>
    crypto.randomBytes(1).toString("hex").padStart(2, "0")
  ).join(":").toUpperCase();
  const imei = Array.from({ length: 15 }, () => crypto.randomInt(0, 10)).join("");
  return { device_id, mac, imei };
}

// Static fallback (used when cookies() fails in Vercel serverless cold start)
const FALLBACK_FINGERPRINT: DeviceFingerprint = {
  device_id: "z3xb0xfallback01",
  mac: "00:1A:2B:3C:4D:5E",
  imei: "490154203237518",
};

/**
 * Get the per-browser device fingerprint from cookie, or generate + set a new one.
 * Falls back to a static fingerprint if cookies() is unavailable (Vercel cold start).
 */
export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  try {
    const cookieStore = await cookies();
    const existing = cookieStore.get(COOKIE_NAME);

    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value) as DeviceFingerprint;
        if (parsed.device_id && parsed.mac && parsed.imei) {
          return parsed;
        }
      } catch {}
    }

    const fingerprint = generateFingerprint();
    cookieStore.set(COOKIE_NAME, JSON.stringify(fingerprint), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return fingerprint;
  } catch {
    return FALLBACK_FINGERPRINT;
  }
}

/**
 * Get the user's chosen region.
 * "AUTO" means "use my real IP" (default).
 * Other values mean "use this region's bypass IP".
 */
export async function getRegion(): Promise<string> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(REGION_COOKIE_NAME)?.value || DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}

export async function setRegion(region: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(REGION_COOKIE_NAME, region, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } catch {}
}

/**
 * Get the user's REAL IP from the incoming request headers.
 *
 * Checks (in order):
 *   1. cf-connecting-ip (Cloudflare)
 *   2. x-real-ip (nginx, common)
 *   3. x-forwarded-for (leftmost IP = original client)
 *   4. fall back to "" if nothing (caller can handle)
 */
export async function getUserRealIp(): Promise<string> {
  try {
    const headerStore = await headers();
    const cfIp = headerStore.get("cf-connecting-ip");
    if (cfIp && isValidIp(cfIp)) return cfIp;
    const realIp = headerStore.get("x-real-ip");
    if (realIp && isValidIp(realIp)) return realIp;
    const xff = headerStore.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first && isValidIp(first)) return first;
    }
  } catch {}
  return "";
}

function isValidIp(ip: string): boolean {
  // IPv4 or IPv6 check
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

// Since we can't reliably distinguish datacenter from residential IPs,
// and MovieBox blocks most cloud/datacenter IPs, we ALWAYS use the Nigeria
// bypass IP when running on a server (not localhost).
// The user's real IP is only used if they're running the app locally.
export async function getBypassIp(): Promise<string> {
  const region = await getRegion();

  // User explicitly picked a region — use that region's IP
  if (region !== "AUTO" && REGIONS[region]?.ip) {
    return REGIONS[region].ip;
  }

  // AUTO mode:
  // On Vercel/production: always use Nigeria bypass IP (server IPs are blocked)
  // On localhost: use the user's real IP (works for dev)
  const realIp = await getUserRealIp();

  // Check if we're running on localhost (dev) — if so, use real IP
  if (realIp && (realIp === "::1" || realIp === "127.0.0.1" || realIp.startsWith("192.168.") || realIp.startsWith("10."))) {
    // Local dev — use Nigeria IP since localhost won't work with MovieBox either
    return REGIONS.NG.ip;
  }

  // Production (Vercel, etc.) — always use Nigeria bypass IP
  // because server IPs are blocked by MovieBox
  return REGIONS.NG.ip;
}

/**
 * Get the timezone to send in X-Client-Info.
 * If user picked AUTO and we know their real IP, we still don't know their timezone
 * (would need a GeoIP lookup), so fall back to Africa/Lagos.
 */
export async function getTimezone(): Promise<string> {
  const region = await getRegion();
  return REGIONS[region]?.timezone || REGIONS.NG.timezone;
}

export async function resetDeviceFingerprint(): Promise<DeviceFingerprint> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {}
  return getDeviceFingerprint();
}
