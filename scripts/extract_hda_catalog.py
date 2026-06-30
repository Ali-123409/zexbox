#!/usr/bin/env python3
"""
Extract the complete HDA catalog (623 episodes) and bundle it as a static JSON.
This gives us instant episode lists without calling HDA's slow API.
"""
import requests, json, re, time
from collections import defaultdict

VERCEL = "https://zexbox.vercel.app"
TARGET = "https://hindidubanime.com"

print("Step 1: Dump all posts via migration API...")
all_posts = []
for page in range(1, 20):
    r = requests.get(f"{VERCEL}/api/pentest?action=migrate&page={page}", timeout=15)
    body = r.json().get("body", "")
    try:
        posts = json.loads(body).get("posts", [])
        if not posts: break
        all_posts.extend(posts)
    except: break
    print(f"  Page {page}: {len(posts)} posts (total: {len(all_posts)})")

animes = [p for p in all_posts if p.get("post_type") == "anime"]
episodes = [p for p in all_posts if p.get("post_type") == "episode" and "Episode" in p.get("post_title", "")]
print(f"\nTotal: {len(animes)} anime, {len(episodes)} episodes")

# Step 2: Fetch anime slugs (for poster URL construction)
print("\nStep 2: Fetch anime data via WP REST...")
anime_data = {}
for i in range(0, len(animes), 20):
    batch = animes[i:i+20]
    ids = ",".join(str(a["ID"]) for a in batch)
    r = requests.get(f"{VERCEL}/api/recon?url={TARGET}/wp-json/wp/v2/anime?include[]={ids}&per_page=20&_fields=id,slug,title,link", timeout=20)
    if r.ok:
        try:
            items = json.loads(r.json().get("body", ""))
            for a in items:
                title = a.get("title", {}).get("rendered", "")
                slug = a.get("slug", "")
                anime_data[a["id"]] = {"slug": slug, "title": title, "link": a.get("link", "")}
            print(f"  Batch {i//20 + 1}: got {len(items)} anime")
        except: pass
    time.sleep(0.5)

print(f"  Got slugs for {len(anime_data)} anime")

# Step 3: Fetch episode slugs (for correct episode URLs)
print("\nStep 3: Fetch episode slugs...")
episode_data = {}
for i in range(0, len(episodes), 50):
    batch = episodes[i:i+50]
    ids = ",".join(str(e["ID"]) for e in batch)
    r = requests.get(f"{VERCEL}/api/recon?url={TARGET}/wp-json/wp/v2/episode?include[]={ids}&per_page=50&_fields=id,slug,link,title", timeout=20)
    if r.ok:
        try:
            items = json.loads(r.json().get("body", ""))
            for e in items:
                episode_data[e["id"]] = {
                    "title": e.get("title", {}).get("rendered", ""),
                    "slug": e.get("slug", ""),
                    "link": e.get("link", ""),
                }
            print(f"  Batch {i//50 + 1}: got {len(items)} episodes")
        except: pass
    time.sleep(0.5)

print(f"  Got slugs for {len(episode_data)} episodes")

# Step 4: Build the catalog — map anime → episodes
print("\nStep 4: Building catalog...")
catalog = {}

for anime_id, ainfo in anime_data.items():
    # Find episodes for this anime by matching title prefix
    anime_title_clean = re.sub(r'\s*Hindi\s*(Sub|Dub).*$', '', ainfo["title"], flags=re.IGNORECASE).strip()
    
    # Match episodes whose title starts with the anime title
    matching_eps = []
    for ep_id, einfo in episode_data.items():
        ep_title = einfo["title"]
        # Clean the episode title for matching
        ep_title_clean = re.sub(r'\s*Episode\s*[-–]\s*\d+.*$', '', ep_title, flags=re.IGNORECASE).strip()
        
        # Match if the episode title contains the anime title (or vice versa)
        if anime_title_clean and (
            ep_title_clean.startswith(anime_title_clean) or 
            anime_title_clean.startswith(ep_title_clean) or
            # Fuzzy match: check if first 10 chars match
            ep_title_clean[:10].lower() == anime_title_clean[:10].lower()
        ):
            # Extract episode number
            ep_num_m = re.search(r'Episode\s*[-–]\s*(\d+)', ep_title, re.IGNORECASE)
            if not ep_num_m:
                ep_num_m = re.search(r'Episode\s*(\d+)', ep_title, re.IGNORECASE)
            ep_num = int(ep_num_m.group(1)) if ep_num_m else len(matching_eps) + 1
            
            matching_eps.append({
                "num": ep_num,
                "title": ep_title,
                "slug": einfo["slug"],
                "link": einfo["link"],
            })
    
    matching_eps.sort(key=lambda x: x["num"])
    
    catalog[ainfo["slug"]] = {
        "id": anime_id,
        "title": ainfo["title"],
        "slug": ainfo["slug"],
        "episode_count": len(matching_eps),
        "episodes": matching_eps,
    }

print(f"\nCatalog built: {len(catalog)} anime")
total_eps = sum(a["episode_count"] for a in catalog.values())
print(f"Total episodes mapped: {total_eps}")

# Step 5: Save the catalog
output_path = "/home/z/my-project/src/lib/hda-catalog.json"
with open(output_path, "w") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

import os
size_kb = os.path.getsize(output_path) / 1024
print(f"\nSaved to: {output_path}")
print(f"File size: {size_kb:.1f} KB")

# Show sample
print("\nSample entry:")
first_key = list(catalog.keys())[0]
sample = catalog[first_key]
print(f"  {sample['title']} ({sample['episode_count']} episodes)")
for ep in sample["episodes"][:3]:
    print(f"    EP{ep['num']}: {ep['link']}")

