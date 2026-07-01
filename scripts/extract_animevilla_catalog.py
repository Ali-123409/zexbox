#!/usr/bin/env python3
"""Fetch the full animevilla.org catalog (294 anime) and save as a static JSON bundle.

Output: /home/z/my-project/src/lib/animevilla-catalog.json
Schema: { [slug]: { id, title, language, year?, poster?, genres?, studio? } }
"""
import json, re, sys, urllib.request, urllib.parse, time

UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
BASE = "https://animevilla.org/wp-json/wp/v2/anime"

def fetch(url, retries=3, timeout=20):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8")), dict(r.headers)
        except Exception as e:
            print(f"  retry {i+1}: {e}", file=sys.stderr)
            time.sleep(0.5 * (i + 1))
    return None, {}

def decode_html(s):
    if not s: return ""
    return (s.replace("&amp;","&").replace("&#038;","&").replace("&#8217;","'")
             .replace("&#8220;",'"').replace("&#8221;",'"').replace("&quot;",'"')
             .replace("&lt;","<").replace("&gt;",">").replace("&#8211;","-")
             .replace("&#8212;","—"))

def strip_tags(s):
    return decode_html(re.sub(r"<[^>]+>", "", s or "")).strip()

def clean_title(raw):
    """Strip '(13) Watch X In Hindi' suffix and language tags."""
    t = raw
    # Remove episode count in parens like "(13)"
    t = re.sub(r"\s*\(\d+\)\s*", " ", t)
    # Remove "Watch X In Hindi" / "Watch X Hindi" trailing
    t = re.sub(r"\s+Watch\s+.+?\s+(?:In\s+)?Hindi\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+Watch\s+.+$", "", t, flags=re.I)
    # Remove language suffix
    t = re.sub(r"\s+Hindi\s+Dubbed\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+Hindi\s+Subbed\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+Hindi\s+Dub\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+Hindi\s+Sub\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+Hindi\s*$", "", t, flags=re.I)
    return t.strip() or raw

def extract_year(text):
    """Try to find a 4-digit year (19xx or 20xx) in the text."""
    m = re.search(r"\b(19[5-9]\d|20[0-4]\d)\b", text or "")
    return m.group(1) if m else None

def extract_episode_count(title, content):
    """Extract episode count from title '(13)' or content."""
    m = re.search(r"\((\d+)\s*(?:eps?|episodes?)?\)", title or "", re.I)
    if m: return int(m.group(1))
    m = re.search(r"\b(\d+)\s*episodes?\b", content or "", re.I)
    if m: return int(m.group(1))
    return None

def main():
    catalog = {}
    page = 1
    total_pages = 3  # we know it's 3 pages of 100
    while page <= total_pages:
        url = f"{BASE}?per_page=100&page={page}&_embed=1&_fields=id,slug,link,title,excerpt,content,featured_media,_embedded,date"
        print(f"Fetching page {page}/{total_pages}...", file=sys.stderr)
        data, headers = fetch(url)
        if not data:
            print(f"  page {page} failed, skipping", file=sys.stderr)
            page += 1
            continue
        if page == 1:
            total_pages = int(headers.get("X-WP-TotalPages", total_pages))
            total_count = int(headers.get("X-WP-Total", 0))
            print(f"  total: {total_count} anime across {total_pages} pages", file=sys.stderr)
        for a in data:
            slug = a.get("slug", "")
            if not slug: continue
            raw_title = strip_tags(a.get("title", {}).get("rendered", ""))
            if not raw_title: continue
            title = clean_title(raw_title)
            content = strip_tags(a.get("content", {}).get("rendered", ""))
            excerpt = strip_tags(a.get("excerpt", {}).get("rendered", ""))
            year = extract_year(content) or extract_year(excerpt)
            ep_count = extract_episode_count(raw_title, content)
            fm = a.get("_embedded", {}).get("wp:featuredmedia", [])
            poster = fm[0].get("source_url") if fm else None
            genres = []
            for term_group in a.get("_embedded", {}).get("wp:term", []):
                for term in term_group:
                    if term.get("taxonomy") == "genre":
                        genres.append(term.get("name"))
            # Determine language
            lang = "Hindi Dub"
            if re.search(r"hindi\s*sub", raw_title, re.I): lang = "Hindi Sub"
            catalog[slug] = {
                "id": str(a.get("id")),
                "title": title,
                "rawTitle": raw_title,
                "language": lang,
                "year": year,
                "episodeCount": ep_count,
                "poster": poster,
                "genres": genres[:5],
                "link": a.get("link", f"https://animevilla.org/anime/{slug}/"),
            }
        page += 1
        time.sleep(0.4)  # be polite

    out = "/home/z/my-project/src/lib/animevilla-catalog.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nSaved {len(catalog)} anime to {out}", file=sys.stderr)
    print(f"File size: {len(json.dumps(catalog).encode('utf-8'))} bytes", file=sys.stderr)

if __name__ == "__main__":
    main()
