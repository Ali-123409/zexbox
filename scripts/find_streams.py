#!/usr/bin/env python3
"""Find the actual stream URLs from NetMirror + HindiDubAnime episodes."""
import json, re, base64, requests

UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json, text/plain, */*"}

# ========================================================
# NetMirror — get full JS, find /api/v2/video/, /api/videos/, /api/related/ patterns
# ========================================================
print("="*70)
print("NetMirror — find detail & stream URL patterns")
print("="*70)
r = requests.get("https://netmirror.global/assets/index-bcaaa8f8.js", headers=H, timeout=20)
js = r.text

# Find each /api/ endpoint with surrounding context
for endpoint in ["/api/search2/", "/api/related/", "/api/v2/video/", "/api/videos/", "/api/v2.0/", "/api/details/"]:
    m = re.search(r'.{120}' + re.escape(endpoint) + r'.{120}', js)
    if m:
        print(f"\n--- {endpoint} context ---")
        print(m.group())

# Find ALL template literal URLs in fetch() calls
print("\n--- All template-literal fetch URLs ---")
seen = set()
for m in re.finditer(r'fetch\(`([^`]+)`', js):
    u = m.group(1)
    if u not in seen and ('api' in u.lower() or 'http' in u.lower()):
        seen.add(u)
        print(f"  {u}")

# Find string concatenation patterns: fetch(a+"/"+b)
print("\n--- All string-concat fetch URLs ---")
for m in re.finditer(r'fetch\(["\']([^"\']+)["\']\s*\+\s*([^,)]+)', js):
    print(f"  base: {m.group(1)}, var: {m.group(2)}")

# Now test the discovered /api/v2/video/ endpoint
print("\n--- Test detail & stream endpoints ---")
# Use Oppenheimer id=20103 we found earlier
test_id = "20103"
for path in [
    f"/api/v2/video/{test_id}",
    f"/api/videos/{test_id}",
    f"/api/video/{test_id}",
    f"/api/details/{test_id}",
    f"/api/movie/{test_id}",
    f"/api/getMovie/{test_id}",
    f"/api/related/{test_id}",
    f"/api/v2/video/{test_id}?page=0",
    f"/api/videos/{test_id}?se=1&ep=1",
    f"/api/videos/{test_id}?embed=true",
    f"/api/v2.0/getMovieVideos?ID={test_id}",
]:
    url = f"https://api2.imdb4.shop{path}"
    try:
        r = requests.get(url, headers={**H, "Referer": "https://netmirror.global/"}, timeout=10)
        if r.status_code == 200 and len(r.text) > 50:
            try:
                d = r.json()
                print(f"  ✓ {path} HTTP 200, keys={list(d.keys())[:8] if isinstance(d, dict) else 'list len=' + str(len(d))}")
                print(f"    Body preview: {json.dumps(d)[:500]}")
            except:
                print(f"  ~ {path} HTTP 200 not JSON, body: {r.text[:200]}")
        else:
            print(f"  ✗ {path} HTTP {r.status_code}")
    except Exception as e:
        print(f"  ! {path} {type(e).__name__}")

# ========================================================
# HindiDubAnime — fetch an episode with _embed=1 to find stream URL
# ========================================================
print("\n" + "="*70)
print("HindiDubAnime — get full episode detail with embed")
print("="*70)

# Get one episode with _embed to get parent anime info
r = requests.get("https://hindidubanime.com/wp-json/wp/v2/episode?per_page=1&_embed=1", headers=H, timeout=30)
print(f"HTTP {r.status_code}, len={len(r.text)}")
if r.status_code == 200:
    eps = r.json()
    if eps:
        ep = eps[0]
        print(f"\nEpisode keys: {list(ep.keys())}")
        print(f"Title: {ep.get('title',{}).get('rendered')}")
        print(f"Slug: {ep.get('slug')}")
        print(f"Link: {ep.get('link')}")
        # Render content to find iframe
        content = ep.get("content", {}).get("rendered", "")
        print(f"Content length: {len(content)}")
        # Find iframe src
        iframes = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', content)
        print(f"Iframes: {iframes}")
        # Find any URL
        urls = re.findall(r'https?://[^\s"\'<>]+', content)
        print(f"All URLs in content: {urls[:10]}")
        # Embedded data
        embedded = ep.get("_embedded", {})
        print(f"Embedded keys: {list(embedded.keys())}")
        for k, v in embedded.items():
            print(f"  {k}: {type(v).__name__}, len={len(v) if isinstance(v, list) else '?'}")
            if isinstance(v, list) and v:
                first = v[0]
                if isinstance(first, dict):
                    print(f"    first keys: {list(first.keys())[:10]}")
                    print(f"    title: {first.get('title',{}).get('rendered','?') if isinstance(first.get('title'), dict) else '?'}")

# Try /wp-json/wp/v2/anime with retries
print("\n--- Retry /wp-json/wp/v2/anime (slow endpoint) ---")
for attempt in range(3):
    try:
        r = requests.get("https://hindidubanime.com/wp-json/wp/v2/anime?per_page=3&_embed=1", headers=H, timeout=45)
        print(f"  Attempt {attempt+1}: HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            d = r.json()
            print(f"  Items: {len(d)}")
            for it in d[:3]:
                print(f"    - {it.get('title',{}).get('rendered','?')} (id={it.get('id')}, slug={it.get('slug')})")
            break
    except Exception as e:
        print(f"  Attempt {attempt+1} ERROR: {type(e).__name__}: {str(e)[:80]}")

# Find the stream iframe format — fetch the episode HTML page directly
print("\n--- Fetch episode HTML page directly ---")
r = requests.get("https://hindidubanime.com/wp-json/wp/v2/episode?per_page=1", headers=H, timeout=20)
if r.status_code == 200:
    ep = r.json()[0]
    link = ep.get("link")
    print(f"Episode link: {link}")
    if link:
        r = requests.get(link, headers=H, timeout=20)
        print(f"  Episode page HTTP {r.status_code}, len={len(r.text)}")
        # Find all iframes
        iframes = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', r.text)
        print(f"  Iframes found: {iframes}")
        # Find video sources
        videos = re.findall(r'<video[^>]+src=["\']([^"\']+)["\']', r.text)
        print(f"  Video tags: {videos}")
        sources = re.findall(r'<source[^>]+src=["\']([^"\']+)["\']', r.text)
        print(f"  Source tags: {sources}")
        # Find storage.googleapis.com streams
        gstorage = re.findall(r'https?://storage\.googleapis\.com/[^\s"\'<>]+', r.text)
        print(f"  Google Storage URLs: {gstorage[:5]}")
        # Find any .mp4 URLs
        mp4s = re.findall(r'https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*', r.text)
        print(f"  .mp4 URLs: {mp4s[:5]}")
