#!/usr/bin/env python3
"""
Probe abyssplayer.com to see if it serves HLS/MP4 (playable in browser)
instead of MKV (not playable).
"""
import requests, re, json

VERCEL = "https://zexbox.vercel.app"
UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"

# Test episodes that have abyssplayer as an alternate
# First, get the alternates for a few gdmirrorbot-only episodes
TEST_SLUGS = [
    "rezero-starting-life-in-another-world-hindi-dubed",
    "dr-stone-new-world-hindi-dubbed",
    "tokyo-ghoul-hindi-dubbed",
    "grand-blue-hindi-dubbed",
    "skeleton-knight-in-another-world-hindi-dubbed",
]

for slug in TEST_SLUGS:
    print(f"\n{'='*60}")
    print(f"Anime: {slug}")
    
    # Get episodes
    r = requests.get(f"{VERCEL}/api/hda-episodes?slug={slug}", timeout=30)
    if not r.ok:
        print(f"  No episodes")
        continue
    eps = r.json().get("episodes", [])
    if not eps:
        print(f"  No episodes")
        continue
    
    # Get stream info for episode 1
    ep_url = eps[0]["link"]
    r2 = requests.get(f"{VERCEL}/api/hindidub?url={ep_url}", timeout=60)
    if not r2.ok:
        print(f"  Stream fetch failed")
        continue
    
    data = r2.json()
    print(f"  Title: {data.get('title','?')[:50]}")
    print(f"  embedUrl: {data.get('embedUrl','?')[:80]}")
    print(f"  streamUrl: {'YES' if data.get('streamUrl') else 'NO'}")
    print(f"  downloadUrl: {data.get('downloadUrl','?')[:80]}")
    
    alternates = data.get("alternates", [])
    print(f"  Alternates ({len(alternates)}):")
    for alt in alternates:
        print(f"    {alt['name']}: {alt['url'][:80]}")
        
        # If it's abyssplayer, check what it serves
        if "abyssplayer" in alt["url"]:
            print(f"    → Fetching abyssplayer page...")
            r3 = requests.get(alt["url"], headers={"User-Agent": UA, "Referer": "https://hindidubanime.com/"}, timeout=15)
            if r3.ok:
                html = r3.text
                title_m = re.search(r'<title>([^<]+)</title>', html)
                print(f"      Title: {title_m.group(1)[:60] if title_m else 'N/A'}")
                
                # Look for video sources
                mp4s = re.findall(r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*', html, re.IGNORECASE)
                m3u8s = re.findall(r'https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html, re.IGNORECASE)
                mkvs = re.findall(r'https?://[^\s"\'<>]+\.mkv[^\s"\'<>]*', html, re.IGNORECASE)
                
                print(f"      MP4 URLs: {len(mp4s)}")
                for u in mp4s[:3]:
                    print(f"        {u[:100]}")
                print(f"      M3U8 URLs: {len(m3u8s)}")
                for u in m3u8s[:3]:
                    print(f"        {u[:100]}")
                print(f"      MKV URLs: {len(mkvs)}")
                
                # Look for API endpoints (like as-cdn21.top has)
                api_patterns = re.findall(r'["\']/(api|player|source|stream|video|get)[a-z0-9/_?=-]*["\']', html, re.IGNORECASE)
                if api_patterns:
                    print(f"      API endpoints: {set(api_patterns)}")
                
                # Look for JS variables with video URLs
                js_vars = re.findall(r'(?:var|let|const)\s+(\w+)\s*=\s*["\']([^"\']*(?:mp4|m3u8|hls|stream|video)[^"\']*)["\']', html, re.IGNORECASE)
                for name, val in js_vars:
                    print(f"      JS var: {name} = {val[:100]}")
                
                # Look for base64 encoded data
                b64_strings = re.findall(r'["\']([A-Za-z0-9+/=]{30,}?)["\']', html)
                import base64
                for b in b64_strings[:3]:
                    try:
                        decoded = base64.b64decode(b).decode('utf-8', errors='ignore')
                        if 'http' in decoded and ('mp4' in decoded or 'm3u8' in decoded or 'stream' in decoded):
                            print(f"      B64 decoded: {decoded[:100]}")
                    except:
                        pass

print("\n\nDONE.")
