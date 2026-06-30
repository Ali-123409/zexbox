#!/bin/bash
# Tests 10 HDA anime end-to-end via agent-browser

ANIMES=(
  "tamon"
  "rezero"
  "dr stone new world"
  "tokyo ghoul"
  "high school dxd"
  "chainsaw man"
  "grand blue"
  "my hero academia"
  "tower of god"
  "skeleton knight"
)

PASS=0
FAIL=0
IFRAME=0
NATIVE=0

for i in "${!ANIMES[@]}"; do
  ANIME="${ANIMES[$i]}"
  NUM=$((i + 1))
  
  echo ""
  echo "============================================"
  echo "TEST $NUM/10: $ANIME"
  echo "============================================"
  
  # Go to search
  agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Search'); if (b) b.click(); return 'ok'; })()" 2>&1 | tail -1
  agent-browser wait 2000 2>&1 | tail -1
  
  # Get textbox ref
  TBREF=$(agent-browser snapshot -i 2>&1 | grep "textbox" | head -1 | grep -oE 'ref=e[0-9]+')
  
  # Fill search
  agent-browser fill "@${TBREF}" "$ANIME" 2>&1 | tail -1
  agent-browser wait 4000 2>&1 | tail -1
  
  # Click HDA card
  RESULT=$(agent-browser eval "(() => {
    const cards = document.querySelectorAll('button[aria-label^=\"Open \"]');
    for (const c of cards) {
      if (c.querySelector('[class*=\"bg-orange-600\"]')) {
        c.click();
        return c.getAttribute('aria-label').replace('Open ', '');
      }
    }
    return 'NO_HDA_CARD';
  })()" 2>&1 | tail -1)
  
  echo "  HDA card: $RESULT"
  
  if [ "$RESULT" = "NO_HDA_CARD" ]; then
    echo "  ❌ FAIL: No HDA card found for '$ANIME'"
    FAIL=$((FAIL + 1))
    continue
  fi
  
  agent-browser wait 3000 2>&1 | tail -1
  
  # Click Watch Online
  agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Watch Online'); if (b) { b.click(); return 'ok'; } return 'no'; })()" 2>&1 | tail -1
  agent-browser wait 18000 2>&1 | tail -1
  
  # Check player state
  STATE=$(agent-browser eval "(() => {
    const v = document.querySelector('video');
    const ifr = document.querySelector('iframe');
    const p = document.querySelector('[class*=\"fixed inset-0\"]');
    if (v) {
      return JSON.stringify({ type: 'NATIVE', t: Math.round(v.currentTime), w: v.videoWidth, h: v.videoHeight, err: v.error?.code });
    }
    if (ifr) {
      return JSON.stringify({ type: 'IFRAME', src: ifr.src.slice(0, 50) });
    }
    if (p) return 'ERROR: ' + p.textContent.slice(0, 80);
    return 'NO_PLAYER';
  })()" 2>&1 | tail -1)
  
  echo "  Player: $STATE"
  
  if echo "$STATE" | grep -q '"type":"NATIVE"'; then
    echo "  ✅ PASS: Native video (no ads)"
    NATIVE=$((NATIVE + 1))
    PASS=$((PASS + 1))
  elif echo "$STATE" | grep -q '"type":"IFRAME"'; then
    echo "  ⚠️ IFRAME: Sandbox embed (ads blocked)"
    IFRAME=$((IFRAME + 1))
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $STATE"
    FAIL=$((FAIL + 1))
  fi
  
  # Close player
  agent-browser eval "(() => { const b = document.querySelector('button[aria-label=\"Close player\"]'); if (b) b.click(); return 'closed'; })()" 2>&1 | tail -1
  agent-browser wait 1000 2>&1 | tail -1
  
  # Take screenshot
  agent-browser screenshot "/home/z/my-project/download/zexbox-test/test-${NUM}-${ANIME// /-}.png" 2>&1 | tail -1
done

echo ""
echo "============================================"
echo "SUMMARY"
echo "============================================"
echo "  Total tested: 10"
echo "  ✅ Native video (no ads): $NATIVE"
echo "  ⚠️  Sandboxed iframe (ads blocked): $IFRAME"
echo "  ❌ Failed: $FAIL"
echo "  ✅ Total playable: $PASS / 10"
