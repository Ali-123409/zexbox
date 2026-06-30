#!/usr/bin/env python3
"""Extract the HDA anime list (slug + title + id) for bundling."""
import requests, json

VERCEL = "https://zexbox.vercel.app"

# Fetch all anime pages
all_anime = []
for page in range(0, 10):
    r = requests.get(f"{VERCEL}/api/hda?action=browse&page={page}", timeout=30)
    if r.ok:
        items = r.json().get("items", [])
        if not items: break
        all_anime.extend(items)
        print(f"  Page {page}: {len(items)} anime (total: {len(all_anime)})")
    else:
        break

print(f"\nTotal anime: {len(all_anime)}")

# Build a compact catalog: slug → {id, title, language}
catalog = {}
for a in all_anime:
    slug = a.get("movieboxSubjectId", "")  # This is the anime slug
    if not slug: continue
    catalog[slug] = {
        "id": a["id"],
        "title": a["title"],
        "language": a.get("language", "Hindi"),
    }

# Save
output = "/home/z/my-project/src/lib/hda-catalog.json"
with open(output, "w") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

import os
size_kb = os.path.getsize(output) / 1024
print(f"\nSaved {len(catalog)} anime to: {output}")
print(f"File size: {size_kb:.1f} KB")

# Show sample
for slug, info in list(catalog.items())[:5]:
    print(f"  {info['title']} (slug={slug}, lang={info['language']})")
