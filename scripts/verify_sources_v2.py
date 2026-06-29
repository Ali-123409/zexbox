#!/usr/bin/env python3
"""Deeper verification - using correct endpoints discovered from existing code."""
import json, requests

UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json, text/plain, */*", "Origin": "https://movie-box.co", "Referer": "https://movie-box.co/"}

print("="*70)
print("1. MovieBox h5-api (CORRECT path: /wefeed-h5api-bff)")
print("="*70)
base = "https://h5-api.aoneroom.com/wefeed-h5api-bff"

# Home endpoint (issues visitor JWT)
r = requests.get(f"{base}/home?host=movie-box.co", headers=H, timeout=15)
print(f"  [home] HTTP {r.status_code}")
print(f"  Response headers: x-user={'yes' if r.headers.get('x-user') else 'no'}, set-cookie={'yes' if r.headers.get('set-cookie') else 'no'}")
if r.status_code == 200:
    d = r.json()
    ops = d.get("data", {}).get("operatingList", [])
    print(f"  Sections: {len(ops)}")
    for op in ops[:5]:
        items = op.get("subjects", [])
        if items:
            print(f"    - {op.get('title', op.get('type'))}: {len(items)} items, first: {items[0].get('title','?')}")

# Trending
r = requests.get(f"{base}/subject/trending?page=0&perPage=5", headers=H, timeout=15)
print(f"  [trending] HTTP {r.status_code}")
if r.status_code == 200:
    d = r.json()
    items = d.get("data", {}).get("subjectList", [])
    print(f"  Trending items: {len(items)}")
    for it in items[:3]:
        print(f"    - {it.get('title','?')} (id={it.get('subjectId', it.get('id'))})")

# Try search variants
for path in ["/subject/search?keyword=demon&page=0", "/search?keyword=demon"]:
    r = requests.get(f"{base}{path}", headers=H, timeout=15)
    print(f"  [{path}] HTTP {r.status_code}")

# Try detail (use first trending id if we got one)
print()
print("="*70)
print("2. NetMirror — try different endpoint shapes")
print("="*70)
for base_url in ["https://api2.imdb4.shop", "https://api2.imdb3.shop"]:
    for path in ["/api/search2?q=oppenheimer", "/api/search?q=oppenheimer", "/api/v2/search?q=oppenheimer", "/search?q=oppenheimer"]:
        try:
            r = requests.get(f"{base_url}{path}", headers={**H, "Referer": "https://netmirror.global/"}, timeout=10)
            if r.status_code == 200:
                print(f"  ✓ {base_url}{path} HTTP {r.status_code}, len={len(r.text)}")
                print(f"    Preview: {r.text[:300]}")
                break
            else:
                print(f"  ✗ {base_url}{path} HTTP {r.status_code}")
        except Exception as e:
            print(f"  ✗ {base_url}{path} ERROR: {e}")

# Look at netmirror's JS to find the actual API path
print()
print("="*70)
print("3. NetMirror — fetch /assets/index to find correct API path")
print("="*70)
try:
    r = requests.get("https://netmirror.global/", headers=H, timeout=15)
    print(f"  Homepage HTTP {r.status_code}, len={len(r.text)}")
    # Find script src
    import re
    scripts = re.findall(r'src="(/assets/[^"]+\.js)"', r.text)
    print(f"  Scripts: {scripts}")
    if scripts:
        r = requests.get(f"https://netmirror.global{scripts[0]}", headers=H, timeout=20)
        print(f"  Main JS HTTP {r.status_code}, len={len(r.text)}")
        # Find API endpoints
        apis = re.findall(r'(https?://[a-z0-9.-]+\.shop[^"\'`]*)', r.text)
        unique = sorted(set(apis))
        print(f"  Unique API hosts found: {len(unique)}")
        for u in unique[:30]:
            print(f"    {u}")
        # Find fetch patterns
        fetches = re.findall(r'fetch\(["\`]([^"\`]+)["\`]', r.text)[:10]
        print(f"  fetch() calls: {fetches}")
        # Search for /api/ paths
        api_paths = sorted(set(re.findall(r'["\`](/api/[a-z0-9/_-]+)["\`]', r.text)))
        print(f"  /api/ paths: {api_paths[:20]}")
except Exception as e:
    print(f"  ERROR: {e}")

print()
print("="*70)
print("4. HindiDubAnime — alternative domains & CDN probe")
print("="*70)
for host in ["hindidubanime.com", "www.hindidubanime.com", "hindidub.pro", "kiranime.com", "kiranime.net"]:
    try:
        r = requests.get(f"https://{host}/wp-json/wp/v2/posts?per_page=2", headers=H, timeout=10)
        print(f"  {host}/wp-json/wp/v2/posts HTTP {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            print(f"    Posts: {len(d)}")
    except Exception as e:
        print(f"  {host} ERROR: {type(e).__name__}: {str(e)[:80]}")

# Try alternate anime wordpress sites
for host in ["animepahe.ru", "animedao.to", "animekisa.in"]:
    try:
        r = requests.get(f"https://{host}/", headers=H, timeout=8, allow_redirects=True)
        print(f"  ALT: {host} HTTP {r.status_code}")
    except Exception as e:
        print(f"  ALT: {host} ERROR: {type(e).__name__}")
