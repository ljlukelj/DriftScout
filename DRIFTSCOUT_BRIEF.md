# DriftScout — Project Brief
> Paste this at the start of any new conversation to get Claude up to speed instantly.

## What is DriftScout?
A fly fishing dashboard web app. Single `index.html` + Cloudflare Worker (`worker.js`). Hosted on GitHub Pages at `ljlukelj.github.io/DriftScout/`.

---

## Infrastructure
| Thing | Value |
|---|---|
| GitHub repo | `ljlukelj.github.io` (DriftScout folder) |
| Live URL | `https://ljlukelj.github.io/DriftScout/` |
| Cloudflare Worker | `yakima-proxy.ljlukelj.workers.dev` |
| Worker routes | `/usgs?site=XXXXXXXX` · `/sites?state=XX` · `/ai` |
| AI model | `claude-sonnet-4-20250514` via `/ai` proxy |
| USGS period | `P2D` (48hrs) — faster than P7D |

**Rule: Always verify USGS gauge IDs before coding any new river. Never guess.**

---

## Worker summary (`worker.js`)
- `/usgs` — fetches `00060,00065,00010` (flow, stage, water temp). Falls back gracefully. 60s edge cache.
- `/sites` — proxies USGS site inventory by state for nationwide search. 1hr cache.
- `/ai` — proxies Anthropic API. Uses `env.ANTHROPIC_API_KEY`.
- All routes return `Access-Control-Allow-Origin: *`

---

## App structure (`index.html`)
Single file, ~895k chars (includes base64 logo SVG). Six tabs:

### 1. Rivers (main dashboard)
- **13 preset WA rivers** with tabs (upperYakima, yakimaCanyon, naches, snoqualmie, methow, okanogan, klickitat, cowlitz, kalama, skykomish, wenatchee, greenRiver, stillaguamish)
- **State picker** — selecting a state instantly swaps river tabs to curated top fly fishing rivers for that state. `renderStateTabs(stateCode)` handles this; WA restores the full preset tabs with hatches/access data via `switchRiver()`. All other states use `loadStateRiver()`.
- **`const STATE_RIVERS`** — curated top rivers for: WA, OR, MT, ID, CO, WY, CA, AK, MN, MI, PA, NY, NC, TN, VT, WI. States not in the object fall back to search-only mode.
- **Nationwide search** — state picker → USGS `/sites` loads in background → type to filter → `loadCustomRiver()` loads any US gauge.
- **Stat cards**: Flow (cfs), Gauge Height (ft), Water Temp (°F — USGS `00010` or estimated), Air Temp (°F), Barometric Pressure (inHg), AI Recommended Setups
- **Wading index bar**, 48hr flow chart (Chart.js), 7-day fishing forecast
- **Hatch calendar**, AI Insights (Claude), Access Points, Regs strip
- Hatch and access point data is only populated for the 13 WA preset rivers. Other states show a placeholder message.

### 2. Knots
- 8 knots as accordion cards. Each card has a **YouTube embed** (AnimatedKnots by Grog channel) + pro tip + AnimatedKnots.com link.
- Confirmed video IDs: Clinch `laNu2Fz_YTc` · Surgeon's `VKnINpBY2gY` · Non-Slip Loop `ocoILa7mL1A` · Blood `L4_3RQZjePs` · Perfection `_xR0eLPAe8c` · Nail `YE2IcxOErj8` · Davy `MB5AWOuJv-s` · Arbor `Ucm3cyAVtdU`

### 3. Trip Log
- **Fully implemented** — localStorage. Fields: date, river, flow, fly pattern, method, fish count, notes.
- Functions: `saveTripEntry()`, `clearTripLog()`, `deleteTripEntry(id)`, `renderTripLog()`, `setDefaultDate()`, `getTripLog()`
- Entries stored as JSON array under key `driftscout_trips` in localStorage.
- Auto-sets today's date when switching to tab. Per-entry delete button. Renders inline without page reload.

### 4. Regulations
- Dropdown selects river → renders from `const REGS` data object.
- Rivers covered: upperYakima, yakimaCanyon, naches, snoqualmie, methow, okanogan, klickitat, cowlitz, kalama, skykomish, wenatchee, greenRiver, stillaguamish
- Each entry has: season, rules[], species[], notes[], wdfw link, eRegs link.

### 5. Calculator
- Tippet size → fly size chart
- Leader formula builder (butt/mid/tippet lengths by clarity)
- Hook size converter
- Split shot weight converter

### 6. Fly Shops
- 10 WA/OR shops with name, location, rivers, tags, website, phone.

---

## Design & Branding
### Color palette (light mode — implemented)
| Variable | Value | Usage |
|---|---|---|
| `--bg` | `#f5f2ed` | Warm off-white page background |
| `--surface` | `#ffffff` | Cards, panels |
| `--surface2` | `#ede9e2` | Inputs, secondary surfaces |
| `--border` | `#d4cfc6` | Card borders |
| `--accent` / `--river` | `#c8441a` | Burnt orange — primary accent (from logo S + fly line) |
| `--green` | `#3a6b35` | Condition good / olive tones |
| `--gold` | `#4e6b2e` | Olive green (from logo D) |
| `--text` | `#1a1a17` | Near-black body text |
| `--muted` | `#6b6659` | Secondary text |

### Logo
- **File**: `vectorised-1779311766827.svg` — VTracer vector of the black-background PNG logo
- **Embedded**: base64 inline in `index.html` as `<img class="driftscout-logo-img">`
- **viewBox**: `260 315 1070 404` — mathematically computed tight crop around logo art (no background)
- **No blend mode** — SVG has no background, paths are pure logo art
- **CSS class**: `.driftscout-logo-img` — `width: clamp(320px, 42vw, 560px)`
- **⚠️ DO NOT alter** the logo in any way — not the SVG paths, colors, viewBox, or CSS sizing. User worked hard on this design.
- Logo sits above `#river-title` (current river name in IBM Plex Mono)

### Header layout
- Padding: `16px 0` top/bottom — intentionally compact
- `.header-top` uses `align-items: center` — logo and meta side by side
- Logo has `margin-bottom: -8px; margin-left: -12px` to pull tight

---

## Critical coding rules

### The IBM Plex Mono apostrophe bomb
**NEVER put `font-family:'IBM Plex Mono'` inside a JavaScript single-quoted string.**
This has broken the entire app multiple times. The apostrophe in `IBM Plex Mono` terminates the JS string early, causing `SyntaxError: Unexpected identifier 'IBM'` which kills every function below it including `onStatePick`.

**Safe patterns:**
```js
// ✓ In HTML attributes (fine — HTML parser handles quotes differently)
<div style="font-family:'IBM Plex Mono',monospace">

// ✓ In JS template literals (fine)
el.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace">text</div>`;

// ✗ BROKEN — apostrophe ends the JS string
el.innerHTML = '<div style="font-family:'IBM Plex Mono',monospace">text</div>';

// ✓ Fix: just omit font-family from JS-assigned innerHTML strings
el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem">text</div>';
```

### Always run Node syntax check before shipping
```bash
# Extract JS and check for syntax errors
python3 -c "
import re, subprocess
html = open('/home/claude/index.html').read()
js = '\n'.join(re.findall(r'<script>(.*?)</script>', html, re.DOTALL))
open('/home/claude/check.js','w').write(js)
r = subprocess.run(['node','--check','/home/claude/check.js'], capture_output=True, text=True)
print('PASS' if r.returncode==0 else 'FAIL: '+r.stderr[:300])
"
```

### Always audit called vs defined functions
```bash
python3 -c "
import re
html = open('/home/claude/index.html').read()
js = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)[0]
called = set(re.findall(r'onclick=\"(\w+)\(', html)+re.findall(r'onchange=\"(\w+)\(', html))
defined = set(re.findall(r'function (\w+)\s*\(', js))
print('Missing:', sorted(called - defined - {'alert','confirm','prompt','parseInt','parseFloat'}))
"
```

---

## All 23 defined JS functions (verified)
`loadAll` · `fetchUSGS` · `fetchWeather` · `generateInsights` · `fetchWaterTemp` · `updateWading` · `updateConditionBanner` · `renderChart` · `renderForecast` · `renderHatches` · `renderAccessPoints` · `switchRiver` · `switchMode` · `renderKnots` · `renderShops` · `renderRegs` · `calcLeader` · `calcHook` · `calcWeight` · `onStatePick` · `filterSites` · `loadCustomRiver` · `renderStateTabs` · `loadStateRiver` · `renderMoonPhase` · `toggleKnot` · `saveTripEntry` · `clearTripLog` · `deleteTripEntry` · `renderTripLog` · `setDefaultDate` · `getTripLog` · `getHatches` · `timeAgo` · `formatDate` · `estimateWaterTemp` · `forecastRating`

---

## Key rivers with verified USGS IDs
| River | Tab ID | USGS Gauge |
|---|---|---|
| Upper Yakima (Easton→Thorpe) | `upperYakima` | `12484500` |
| Yakima Canyon (Roza→Ellensburg) | `yakimaCanyon` | `12487000` |
| Naches River | `naches` | `12494400` |
| Snoqualmie MF | `snoqualmie` | `12141300` |
| Methow (Winthrop) | `methow` | `12448500` |
| Okanogan | `okanogan` | `12447200` |
| Klickitat | `klickitat` | `14113000` |
| Cowlitz (Packwood) | `cowlitz` | `14226500` |
| Kalama | `kalama` | `14223000` |
| Green River | `greenRiver` | `12113000` |
| Skykomish (Gold Bar) | `skykomish` | `12134500` |
| Wenatchee (Peshastin) | `wenatchee` | `12462500` |
| Stillaguamish (Arlington) | `stillaguamish` | `12167000` |

---

## Known working state
Last good outputs: `/mnt/user-data/outputs/index.html`
Working copy during session: `/home/claude/index.html`

**Always use Python scripts for edits — never str_replace on large blocks. Write changes as a `.py` file, run it, validate brace delta = 0, run Node syntax check, then copy to outputs.**

**Logo is base64-encoded inline — re-encoding from source SVG requires the file `vectorised-1779311766827.svg`. Always re-embed from source file, never guess the b64 string.**

---

## Remaining wish list (not yet done)
- [ ] Knot animations — YouTube embeds are current workaround. Real animated SVGs would require hosted assets.
- [ ] Regulations — currently static `const REGS`. Could use AI to fetch/summarize eregulations.com on demand.
- [ ] Flow refresh speed — Yakima Canyon (`12487000`) and Kalama (`14223000`) can be slow on first load.
- [ ] Hatch + access data for non-WA state rivers — currently shows placeholder text.
- [ ] More rivers — user wants to keep expanding preset rivers.

---

## Token efficiency tips for working sessions
1. **Paste this file** at the start of any new conversation instead of re-explaining.
2. **Say "work on X"** — don't recap the whole app.
3. **One feature at a time** — Claude can fix/add one thing cleanly per session.
4. **Use Claude Projects** — project instructions load automatically, no paste needed.
5. **Always run Node syntax check before shipping** — see Critical coding rules above.
6. **Save outputs immediately** — download `index.html` after every working session.

---

## How to set up Claude Projects (recommended)
1. Go to claude.ai → click **Projects** in sidebar
2. Create project: "DriftScout"
3. Paste the contents of this file into **Project Instructions**
4. Upload `index.html` and `worker.js` as **Project Files**
5. Every new conversation in this project auto-loads the context — no token waste

---

## Dev workflow
```
1. cp /mnt/user-data/outputs/index.html /home/claude/index.html   # restore base
2. write /home/claude/fix.py                                        # write changes as Python
3. python3 /home/claude/fix.py                                      # run it
4. node --check /home/claude/check.js                               # syntax check (see above)
5. check brace delta == 0, audit called vs defined functions
6. cp /home/claude/index.html /mnt/user-data/outputs/index.html    # ship
```
