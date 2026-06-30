import json

# Read the catalog
catalog = json.load(open('/home/z/my-project/src/lib/hda-catalog.json'))

# Pick 10 diverse anime
test_slugs = [
    "tamons-b-side-hindi-dubbed",           # as-cdn21.top (HLS)
    "rezero-starting-life-in-another-world-hindi-dubed",  # gdmirrorbot (MKV)
    "dr-stone-new-world-hindi-dubbed",      # gdmirrorbot
    "tokyo-ghoul-hindi-dubbed",             # unknown player
    "high-school-dxd",                      # unknown player
    "chainsaw-man-the-movie-reze-arc",      # movie
    "grand-blue-hindi-dubbed",              # comedy
    "my-hero-academia-final-season",        # popular
    "tower-of-god",                         # action
    "skeleton-knight-in-another-world-hindi-dubbed",  # isekai
]

for i, slug in enumerate(test_slugs):
    info = catalog.get(slug, {})
    print(f"{i+1}. {info.get('title', 'UNKNOWN')} (slug={slug})")
