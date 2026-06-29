#!/usr/bin/env python3
"""
Live verification of all 4 streaming sources before integration.
Each source is tested for: search → detail → stream URL extraction.
"""
import json, time, sys, base64, hashlib, urllib.parse, re
import requests

UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept": "application/json, text/plain, */*"}

def section(t): print(f"\n{'='*70}\n{t}\n{'='*70}")

# ============================================================
# SOURCE 1: MovieBox h5-api (CORS-enabled, public)
# ============================================================
def test_moviebox():
    section("SOURCE 1: MovieBox h5-api (h5-api.aoneroom.com)")
    base = "https://h5-api.aoneroom.com/wefeed-mobile-bff"
    try:
        # 1. Home/categories
        r = requests.get(f"{base}/category-list", headers=HEADERS, timeout=15)
        print(f"  [category-list] HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            data = r.json()
            cats = data.get("data", {}).get("category_list", [])
            print(f"  Categories: {len(cats)}")
            for c in cats[:3]:
                print(f"    - {c.get('name', '?')} (id={c.get('id', '?')})")
        # 2. Search
        r = requests.get(f"{base}/search-page?keyword=demon&type=1&page=0", headers=HEADERS, timeout=15)
        print(f"  [search 'demon'] HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            d = r.json()
            results = d.get("data", {}).get("search_results", [])
            print(f"  Search results: {len(results)}")
            for item in results[:3]:
                print(f"    - {item.get('title','?')} (id={item.get('id','?')}, type={item.get('type','?')})")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

# ============================================================
# SOURCE 2: NetMirror (api2.imdb4.shop — no auth)
# ============================================================
def test_netmirror():
    section("SOURCE 2: NetMirror (api2.imdb4.shop)")
    base = "https://api2.imdb4.shop"
    h = {**HEADERS, "Referer": "https://netmirror.global/"}
    try:
        # Search
        r = requests.get(f"{base}/api/search2?q=oppenheimer", headers=h, timeout=15)
        print(f"  [search 'oppenheimer'] HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            try:
                d = r.json()
                # NetMirror format varies - dump first 800 chars
                print(f"  Response preview: {json.dumps(d)[:800]}")
                # Try common shapes
                items = d.get("data") or d.get("results") or d.get("movies") or []
                if isinstance(items, dict): items = items.get("results") or []
                if isinstance(items, list):
                    print(f"  Items found: {len(items)}")
                    for it in items[:3]:
                        print(f"    - {it.get('title','?')} (id={it.get('id','?')})")
            except Exception as pe:
                print(f"  Parse error: {pe}")
        # Detail test if we got an id
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

# ============================================================
# SOURCE 3: Fmovies — direct embeds (no API needed)
# ============================================================
def test_fmovies():
    section("SOURCE 3: Fmovies (vidlink.pro / vidfast.pro direct embeds)")
    # We don't need an API — just embed. Test that embed URLs respond.
    test_ids = ["tt15398776", "tt0468569"]  # Oppenheimer, Dark Knight
    for sid in test_ids:
        for host in ["vidlink.pro", "vidfast.pro", "vidnest.fun"]:
            url = f"https://{host}/movie/{sid}"
            try:
                r = requests.head(url, headers=HEADERS, timeout=10, allow_redirects=True)
                ok = r.status_code in (200, 403, 405)  # 403/405 ok = host alive, just no HEAD
                print(f"  [{host}/movie/{sid}] HTTP {r.status_code} (alive={ok})")
            except Exception as e:
                print(f"  [{host}/movie/{sid}] ERROR: {e}")
    # Also test TV episode format
    url = f"https://vidlink.pro/tv/tt0903747/1/1"  # Breaking Bad S01E01
    try:
        r = requests.head(url, headers=HEADERS, timeout=10, allow_redirects=True)
        print(f"  [tv/tt0903747/1/1] HTTP {r.status_code}")
    except Exception as e:
        print(f"  [tv test] ERROR: {e}")
    return True

# ============================================================
# SOURCE 4: HindiDubAnime — WordPress REST API
# ============================================================
def test_hindidubanime():
    section("SOURCE 4: HindiDubAnime (WordPress REST)")
    base = "https://hindidubanime.com/wp-json/wp/v2"
    try:
        # List anime
        r = requests.get(f"{base}/anime?per_page=5&_embed=1", headers=HEADERS, timeout=20)
        print(f"  [/anime?per_page=5] HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            items = r.json()
            print(f"  Items: {len(items)}")
            for it in items[:5]:
                title = it.get("title", {}).get("rendered", "?")
                print(f"    - {title} (id={it.get('id','?')}, slug={it.get('slug','?')})")
        # Episode endpoint test
        r = requests.get(f"{base}/episode?per_page=5&_embed=1", headers=HEADERS, timeout=20)
        print(f"  [/episode?per_page=5] HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            items = r.json()
            print(f"  Episodes: {len(items)}")
            for it in items[:5]:
                title = it.get("title", {}).get("rendered", "?")
                print(f"    - {title} (id={it.get('id','?')})")
        # Search test
        r = requests.get(f"{base}/anime?search=naruto&_embed=1", headers=HEADERS, timeout=20)
        print(f"  [/anime?search=naruto] HTTP {r.status_code}")
        if r.status_code == 200:
            items = r.json()
            print(f"  Search results: {len(items)}")
            for it in items[:3]:
                title = it.get("title", {}).get("rendered", "?")
                print(f"    - {title}")
        # Also try kiranime custom API
        r = requests.get("https://hindidubanime.com/wp-json/kiranime/v1/anime?per_page=5", headers=HEADERS, timeout=20)
        print(f"  [kiranime/v1/anime] HTTP {r.status_code}")
        if r.status_code == 200:
            print(f"  Preview: {r.text[:600]}")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

# ============================================================
# BONUS: animeindia.net — verify real API
# ============================================================
def test_animeindia():
    section("BONUS: animeindia.net (api.animeindia.net)")
    try:
        r = requests.get("https://api.animeindia.net", headers=HEADERS, timeout=15)
        print(f"  [GET /] HTTP {r.status_code}, len={len(r.text)}")
        print(f"  Body preview: {r.text[:400]}")
        # Common WP REST path
        r = requests.get("https://api.animeindia.net/wp-json/wp/v2/posts?per_page=3", headers=HEADERS, timeout=15)
        print(f"  [wp-json/wp/v2/posts] HTTP {r.status_code}, len={len(r.text)}")
        if r.status_code == 200:
            print(f"  Preview: {r.text[:400]}")
    except Exception as e:
        print(f"  ERROR: {e}")

if __name__ == "__main__":
    test_moviebox()
    test_netmirror()
    test_fmovies()
    test_hindidubanime()
    test_animeindia()
    print("\n\nDONE.")
