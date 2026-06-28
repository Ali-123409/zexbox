/**
 * Quick API verification script.
 * Run: bun /home/z/my-project/scripts/test-moviebox.ts
 */
import {
  getGuestJwt,
  getTrending,
  searchAll,
  getSubjectDetail,
  getPlayInfo,
  normalizeItems,
  normalizePlaySources,
} from "../src/lib/moviebox";

async function main() {
  console.log("=== 1. Guest JWT ===");
  const jwt = await getGuestJwt();
  console.log("JWT:", jwt ? `${jwt.slice(0, 50)}... (${jwt.length} chars)` : "(none)");

  console.log("\n=== 2. Trending Movies ===");
  try {
    const trending = await getTrending(1, "movie");
    const items = normalizeItems(trending);
    console.log(`Got ${items.length} items`);
    if (items.length > 0) {
      console.log("First item:", JSON.stringify(items[0], null, 2));
    } else {
      console.log("Raw response (first 800 chars):", JSON.stringify(trending).slice(0, 800));
    }
  } catch (e: any) {
    console.error("Trending failed:", e?.message);
  }

  console.log("\n=== 3. Search 'avengers' ===");
  try {
    const results = await searchAll("avengers");
    const items = normalizeItems(results);
    console.log(`Got ${items.length} results`);
    if (items.length > 0) {
      console.log("First result:", JSON.stringify(items[0], null, 2));
    } else {
      console.log("Raw response (first 800 chars):", JSON.stringify(results).slice(0, 800));
    }
  } catch (e: any) {
    console.error("Search failed:", e?.message);
  }

  console.log("\n=== 4. Subject Detail + Play Info ===");
  try {
    const trending = await getTrending(1, "movie");
    const items = normalizeItems(trending);
    if (items.length > 0) {
      const id = items[0].id;
      console.log(`Fetching detail for id=${id}`);
      const detail = await getSubjectDetail(id);
      console.log("Detail (first 800 chars):", JSON.stringify(detail).slice(0, 800));

      console.log("\n=== 5. Play Info ===");
      const play = await getPlayInfo(id);
      console.log("Play info (first 1200 chars):", JSON.stringify(play).slice(0, 1200));
      const sources = normalizePlaySources(play);
      console.log(`Normalized ${sources.length} play sources`);
      if (sources.length > 0) console.log("First source:", sources[0]);
    } else {
      console.log("Skipping detail test — no trending items");
    }
  } catch (e: any) {
    console.error("Detail failed:", e?.message);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
