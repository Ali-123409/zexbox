#!/usr/bin/env python3
"""
Probe Hindi anime sites for usable APIs and stream URLs.
"""
import requests, json, re

VERCEL = "https://zexbox.vercel.app"
UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"

SITES = [
    ("https://animehindidub.com", "AnimeHindiDub"),
    ("https://animeindia.net", "AnimeIndia"),
    ("https://animeinhindi.com", "AnimeInHindi"),
    ("https://hindidubbedanime.com", "HindiDubbedAnime"),
    ("https://www.animeindia.in", "AnimeIndia.in"),
    ("https://animehindi.com", "AnimeHindi"),
    ("https://hindianime.com", "HindiAnime"),
    ("https://www.hindidubbed.com", "HindiDubbed"),
]

for url, name in SITES:
    print(f"\n{'='*60}")
    print(f"SITE: {name} ({url})")
    print(f"{'='*60}")
    
    # 1. Check if site is alive
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": UA})
        print(f"  Homepage: HTTP {r.status_code}, {len(r.text)} bytes")
        if r.status_code != 200:
            print(f"  ⚠️ Site not accessible")
            continue
    except Exception as e:
        print(f"  ⚠️ Connection failed: {str(e)[:50]}")
        continue
    
    html = r.text
    
    # 2. Check for WordPress
    wp_gen = re.search(r'WordPress ([\d.]+)', html)
    theme = re.search(r'/wp-content/themes/([^/]+)/', html)
    is_wp = bool(wp_gen) or bool(theme)
    print(f"  WordPress: {'YES ' + (wp_gen.group(1) if wp_gen else '') if is_wp else 'NO'}")
    if theme:
        print(f"  Theme: {theme.group(1)}")
    
    # 3. Check for WP REST API
    if is_wp:
        try:
            r2 = requests.get(f"{url}/wp-json/", timeout=10, headers={"User-Agent": UA})
            if r2.ok:
                try:
                    rest = r2.json()
                    routes = rest.get("routes", {})
                    custom = [r for r in routes if not r.startswith("/wp/v2/") and r != "/"]
                    print(f"  REST API: YES ({len(routes)} routes, {len(custom)} custom)")
                    # Show interesting custom routes
                    for c in custom[:5]:
                        print(f"    {c}")
                except:
                    print(f"  REST API: returns non-JSON")
            else:
                print(f"  REST API: HTTP {r2.status_code}")
        except:
            print(f"  REST API: unreachable")
    
    # 4. Check for custom post types (anime/episode)
    if is_wp:
        for cpt in ["anime", "episode", "series", "video"]:
            try:
                r3 = requests.get(f"{url}/wp-json/wp/v2/{cpt}?per_page=1", timeout=10, headers={"User-Agent": UA})
                if r3.ok:
                    data = r3.json()
                    count = len(data) if isinstance(data, list) else 0
                    if count > 0:
                        print(f"  CPT '{cpt}': {count} posts found ✅")
                        # Show first item
                        if isinstance(data, list) and data:
                            title = data[0].get("title", {}).get("rendered", "?")
                            print(f"    First: {title[:40]}")
            except:
                pass
    
    # 5. Look for stream/embed URLs in homepage
    iframes = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if iframes:
        print(f"  Iframes on homepage: {len(iframes)}")
        for i in iframes[:3]:
            print(f"    {i[:80]}")
    
    # 6. Look for known video player domains
    player_domains = set()
    for pattern in [r'(https?://[a-z0-9-]+\.(?:com|net|org|top|nl|dev)/video)', 
                    r'(https?://[a-z0-9-]+\.workers\.dev)',
                    r'(https?://(?:stream|play|embed|watch|cdn)[a-z0-9.-]+\.[a-z]+)']:
        matches = re.findall(pattern, html, re.IGNORECASE)
        player_domains.update(matches)
    if player_domains:
        print(f"  Player/CDN domains: {player_domains}")
    
    # 7. Check for search functionality
    search_form = re.search(r'<form[^>]*search[^>]*>', html, re.IGNORECASE)
    if search_form:
        print(f"  Search form: YES")
    
    # 8. Check for anime streaming JS frameworks
    for framework in ["kiranime", "animix", "animejs", "playerjs", "jwplayer", "videojs", "plyr", "hls.js"]:
        if framework.lower() in html.lower():
            print(f"  JS Framework: {framework}")

print("\n\nDONE.")
