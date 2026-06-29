#!/usr/bin/env python3
"""Final deep probe — find correct endpoints for NetMirror + HindiDubAnime + animeindia."""
import json, re, requests

UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json, text/plain, */*"}

# ============================================
# NetMirror — find actual search URL pattern
# ============================================
print("="*70)
print("NetMirror — JS analysis to find real search URL")
print("="*70)
r = requests.get("https://netmirror.global/assets/index-bcaaa8f8.js", headers=H, timeout=20)
js = r.text

# Find context around "search2"
for m in re.finditer(r'.{100}search2.{200}', js):
    print(f"\n--- Context: ---\n{m.group()}\n")
    break

# Find what's around "imdb4.shop"
for m in re.finditer(r'.{80}imdb4\.shop.{100}', js):
    print(f"\n--- imdb4 context ---\n{m.group()}\n")
    break

# Find what k() function returns - search for k= or function k
m = re.search(r'function\s+k\s*\([^)]*\)\s*\{[^}]+\}', js)
if m:
    print(f"\n--- k function ---\n{m.group()[:500]}")

# Look for fetch with /api/
for i, m in enumerate(re.finditer(r'fetch\(`([^`]*?/api/[^`]*?)`', js)):
    if i >= 5: break
    print(f"fetch call: {m.group(1)}")

# Find search-related text
for i, m in enumerate(re.finditer(r'.{60}(search|query|keyword).{60}', js)):
    if i >= 5: break
    s = m.group()
    if 'api' in s.lower() or 'fetch' in s.lower():
        print(f"  search ref: {s}")

# Find specific patterns around API calls
m = re.search(r'(api2\.imdb4\.shop[^"\'`]*?search[^"\'`]+)', js)
if m:
    print(f"\nFound: {m.group()}")

# Look for axios or fetch with .get
for i, m in enumerate(re.finditer(r'\.(?:get|post)\(["`\$]{1,3}([^"\'`]+)["`]', js)):
    if i >= 10: break
    print(f"  .get/.post: {m.group(1)}")

# Find URL building — template literals starting with api
matches = re.findall(r'`\$\{[A-Za-z]+\}/api/[^`]+`', js)
print(f"\nTemplate literal api URLs: {matches[:10]}")

# Find query param shapes - look at what comes after search2
m = re.search(r'search2[^"\'`]{0,200}', js)
if m: print(f"\nAfter search2: {m.group()}")

# Try POST instead of GET
print("\n--- Test POST to /api/search2 ---")
r = requests.post("https://api2.imdb4.shop/api/search2", headers={**H, "Referer": "https://netmirror.global/", "Content-Type": "application/json"}, json={"keyword": "oppenheimer"}, timeout=10)
print(f"POST JSON: HTTP {r.status_code}, len={len(r.text)}")
if r.status_code == 200:
    print(f"  Body: {r.text[:300]}")

# Real pattern from JS: F='https://api2.imdb4.shop/api/search2', k => encodeURIComponent.replace(%20, +)
# URL: ${F}/${k(keyword)}?page=0  =>  /api/search2/oppenheimer?page=0
print("\n--- Test REAL pattern from JS ---")
for kw in ["oppenheimer", "spider", "inception", "demon+slayer", "oppenheimer+2023"]:
    url = f"https://api2.imdb4.shop/api/search2/{kw}?page=0"
    try:
        r = requests.get(url, headers={**H, "Referer": "https://netmirror.global/"}, timeout=8)
        print(f"  {url} -> HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            try:
                d = r.json()
                if isinstance(d, list):
                    print(f"    Items: {len(d)}")
                    for it in d[:3]:
                        print(f"      - {it.get('title','?')} (id={it.get('id','?')})")
                elif isinstance(d, dict):
                    print(f"    Keys: {list(d.keys())[:10]}")
                    items = d.get('data') or d.get('results') or d.get('movies') or []
                    print(f"    Items: {len(items)}")
                    for it in (items[:3] if isinstance(items, list) else []):
                        print(f"      - {it.get('title','?')} (id={it.get('id','?')})")
            except Exception as e:
                print(f"    Parse: {e} - body: {r.text[:200]}")
    except Exception as e:
        print(f"    ERROR: {e}")

# ============================================
# HindiDubAnime — try /wp-json/wp/v2/anime
# ============================================
print("\n" + "="*70)
print("HindiDubAnime — test anime-specific endpoints")
print("="*70)
for host in ["hindidubanime.com", "kiranime.com", "kiranime.net"]:
    print(f"\n--- {host} ---")
    # Standard WP REST
    for path in ["/wp-json/wp/v2/anime?per_page=3", "/wp-json/wp/v2/episode?per_page=3", "/wp-json/wp/v2/posts?per_page=3", "/wp-json/wp/v2/categories?per_page=5"]:
        try:
            r = requests.get(f"https://{host}{path}", headers=H, timeout=15)
            if r.status_code == 200:
                try:
                    d = r.json()
                    n = len(d) if isinstance(d, list) else "obj"
                    print(f"  ✓ {path} HTTP 200 items={n}")
                    if isinstance(d, list) and d:
                        first = d[0]
                        title = first.get("title", {}).get("rendered", "?") if isinstance(first, dict) else "?"
                        print(f"    First: {title} (id={first.get('id') if isinstance(first, dict) else '?'})")
                except Exception as e:
                    print(f"  ~ {path} HTTP 200 but not JSON ({type(e).__name__})")
            else:
                print(f"  ✗ {path} HTTP {r.status_code}")
        except Exception as e:
            print(f"  ! {path} {type(e).__name__}")

    # Kiranime custom API
    for path in ["/wp-json/kiranime/v1/anime?per_page=3", "/wp-json/kiranime/v1/episode?per_page=3", "/wp-json/kiranime/v1/home", "/wp-json/kiranime/v1/list"]:
        try:
            r = requests.get(f"https://{host}{path}", headers=H, timeout=15)
            if r.status_code == 200:
                print(f"  ✓ {path} HTTP 200 len={len(r.text)}")
                print(f"    Preview: {r.text[:200]}")
            else:
                print(f"  ✗ {path} HTTP {r.status_code}")
        except Exception as e:
            print(f"  ! {path} {type(e).__name__}")

# ============================================
# animeindia.net — probe api.animeindia.net
# ============================================
print("\n" + "="*70)
print("animeindia.net api.animeindia.net probe")
print("="*70)
r = requests.get("https://animeindia.net/", headers=H, timeout=15)
print(f"Homepage HTTP {r.status_code}")
scripts = re.findall(r'src="([^"]+\.js[^"]*)"', r.text)
print(f"Scripts: {scripts[:5]}")
# Look for /api/ in homepage source
api_refs = re.findall(r'(api\.animeindia\.net/[a-zA-Z0-9/_-]+)', r.text)
print(f"api.animeindia.net paths in HTML: {set(api_refs)}")

# Try common endpoints on api.animeindia.net
for path in ["/api", "/api/v1/anime", "/api/anime", "/api/posts", "/api/search?q=naruto", "/api/v1/posts", "/v1/anime", "/anime"]:
    try:
        r = requests.get(f"https://api.animeindia.net{path}", headers=H, timeout=10)
        if r.status_code == 200 and len(r.text) > 30:
            print(f"  ✓ {path} HTTP 200 len={len(r.text)}")
            print(f"    Body: {r.text[:200]}")
        else:
            print(f"  ✗ {path} HTTP {r.status_code}")
    except Exception as e:
        print(f"  ! {path} {type(e).__name__}")
