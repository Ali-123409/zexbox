#!/usr/bin/env python3
"""NetMirror stream test + HindiDubAnime stream discovery via meta/HTML."""
import json, re, base64, time, requests

UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
H = {"User-Agent": UA, "Accept": "application/json, text/plain, */*"}

# ========================================================
# NetMirror — get subjectid from /api/movie/{id}, then test embeds
# ========================================================
print("="*70)
print("NetMirror — find stream URL via subjectid")
print("="*70)

# Get Oppenheimer details
r = requests.get("https://api2.imdb4.shop/api/movie/20103", headers={**H, "Referer": "https://netmirror.global/"}, timeout=10)
if r.status_code == 200:
    d = r.json()
    if d.get("results"):
        movie = d["results"][0]
        subjectid = movie.get("subjectid")
        print(f"Title: {movie.get('title')}")
        print(f"subjectid: {subjectid}")
        print(f"seasons: {movie.get('season')}")
        print(f"media_type: {movie.get('media_type')}")
        # Test spedostream2.shop embed URL
        for tmpl in [
            f"https://spedostream2.shop/play/watchbox.php?id={subjectid}",
            f"https://watch20.online/play/{subjectid}",
            f"https://watch-download.shop/watchbox/artplayerlive.php?url={subjectid}",
            f"https://spedostream2.shop/play/watchbox.php?id={movie.get('id')}",
        ]:
            try:
                r = requests.head(tmpl, headers={**H, "Referer": "https://netmirror.global/"}, timeout=10, allow_redirects=True)
                print(f"  HEAD {tmpl} -> HTTP {r.status_code}")
                if r.status_code == 200:
                    r = requests.get(tmpl, headers={**H, "Referer": "https://netmirror.global/"}, timeout=15)
                    # Find iframe / video / source tags
                    iframes = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', r.text)
                    sources = re.findall(r'<source[^>]+src=["\']([^"\']+)["\']', r.text)
                    m3u8 = re.findall(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', r.text)
                    mp4 = re.findall(r'(https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*)', r.text)
                    print(f"    iframes: {iframes[:3]}")
                    print(f"    sources: {sources[:3]}")
                    print(f"    m3u8: {m3u8[:3]}")
                    print(f"    mp4: {mp4[:3]}")
            except Exception as e:
                print(f"  ERROR {tmpl}: {e}")

# Also test: maybe NetMirror stream URL is direct from /api/movie/{id} with se/ep
print("\n--- Test /api/movie/{id} with se/ep params ---")
for path in [
    "/api/movie/20103?se=1&ep=1",
    "/api/movie/20103?se=0&ep=0",
    "/api/videos/20103?se=1&ep=1",
    "/api/v2/video/20103?se=1&ep=1",
    "/api/getStream/20103",
    "/api/stream/20103",
]:
    try:
        r = requests.get(f"https://api2.imdb4.shop{path}", headers={**H, "Referer": "https://netmirror.global/"}, timeout=8)
        if r.status_code == 200:
            print(f"  ✓ {path} HTTP 200, preview: {r.text[:300]}")
        else:
            print(f"  ✗ {path} HTTP {r.status_code}")
    except Exception as e:
        print(f"  ! {path} {type(e).__name__}")

# ========================================================
# HindiDubAnime — discover stream URL via episode page HTML (retry logic)
# ========================================================
print("\n" + "="*70)
print("HindiDubAnime — fetch episode HTML page with retries")
print("="*70)

# Get one episode first
r = requests.get("https://hindidubanime.com/wp-json/wp/v2/episode?per_page=1", headers=H, timeout=45)
print(f"Episode list HTTP {r.status_code}")
if r.status_code == 200:
    ep = r.json()[0]
    link = ep.get("link")
    print(f"Link: {link}")
    slug = ep.get("slug")
    print(f"Slug: {slug}")

    # Also try the meta endpoint
    print("\n--- Test meta endpoints ---")
    for path in [
        f"/wp-json/wp/v2/episode?slug={slug}&_embed=1",
        f"/wp-json/wp/v2/episode/{ep.get('id')}?_fields=meta,acf,video_url",
        f"/wp-json/wp/v2/episode/{ep.get('id')}?_embed=1",
        f"/wp-json/acf/v3/episode/{ep.get('id')}",
        f"/wp-json/wp/v2/episode?include[]={ep.get('id')}&_fields=id,title,link,excerpt,content,episode_type,meta",
    ]:
        try:
            r = requests.get(f"https://hindidubanime.com{path}", headers=H, timeout=45)
            print(f"  {path}")
            print(f"    HTTP {r.status_code}, len={len(r.text)}")
            if r.status_code == 200:
                try:
                    d = r.json()
                    if isinstance(d, list) and d:
                        d = d[0]
                    if isinstance(d, dict):
                        # Look for stream-related keys
                        for k, v in d.items():
                            if any(w in k.lower() for w in ['video', 'stream', 'embed', 'player', 'url', 'meta', 'acf']):
                                preview = str(v)[:300]
                                print(f"    {k}: {preview}")
                except Exception as e:
                    print(f"    Parse: {e}")
        except Exception as e:
            print(f"  {path} ERROR: {type(e).__name__}: {str(e)[:60]}")

    # Now fetch the HTML page with longer timeout
    print(f"\n--- Fetch HTML page: {link} ---")
    for attempt in range(3):
        try:
            r = requests.get(link, headers=H, timeout=60)
            print(f"  Attempt {attempt+1}: HTTP {r.status_code}, len={len(r.text)}")
            if r.status_code == 200:
                # Find iframes, video sources, m3u8, mp4
                iframes = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', r.text)
                sources = re.findall(r'<source[^>]+src=["\']([^"\']+)["\']', r.text)
                m3u8 = re.findall(r'(https?://[^\s"\'<>]+\.m3u8[^\s"\'<>]*)', r.text)
                mp4 = re.findall(r'(https?://[^\s"\'<>]+\.mp4[^\s"\'<>]*)', r.text)
                # Look for player-related JS
                player_vars = re.findall(r'player[_-]?(?:src|url|file|source)\s*[:=]\s*["\']([^"\']+)["\']', r.text, re.IGNORECASE)
                # storage.googleapis.com
                gstorage = re.findall(r'https?://storage\.googleapis\.com/[^\s"\'<>]+', r.text)
                # abyssplayer.com
                abyss = re.findall(r'https?://[a-z.]*abyssplayer\.com[^\s"\'<>]*', r.text)
                # Find data-* attributes pointing to videos
                data_video = re.findall(r'data-(?:video|src|url|file|stream)=["\']([^"\']+)["\']', r.text)
                
                print(f"  iframes: {iframes[:5]}")
                print(f"  sources: {sources[:5]}")
                print(f"  m3u8: {m3u8[:5]}")
                print(f"  mp4: {mp4[:5]}")
                print(f"  player_vars: {player_vars[:5]}")
                print(f"  storage.googleapis.com: {gstorage[:5]}")
                print(f"  abyssplayer: {abyss[:5]}")
                print(f"  data-video: {data_video[:5]}")
                break
        except Exception as e:
            print(f"  Attempt {attempt+1} ERROR: {type(e).__name__}: {str(e)[:80]}")
            time.sleep(2)
