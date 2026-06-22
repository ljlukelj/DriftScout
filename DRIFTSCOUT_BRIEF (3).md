# DriftScout — Project Brief
> Upload this as a Project File and paste into Project Instructions at the start of any new session.
> Do NOT re-audit the codebase — trust this file.

---

## What is DriftScout?
A fly fishing dashboard web app. Single `index.html` + Cloudflare Worker (`worker.js`).
Hosted on GitHub Pages at `https://ljlukelj.github.io/DriftScout/`.

---

## Infrastructure
| Thing | Value |
|---|---|
| GitHub repo | `ljlukelj.github.io` (DriftScout folder) |
| Live URL | `https://ljlukelj.github.io/DriftScout/` |
| Cloudflare Worker | `yakima-proxy.ljlukelj.workers.dev` |
| Worker routes | `/usgs?site=` · `/usgs/current?site=` · `/sites?state=` · `/ai` |
| AI model | `claude-sonnet-4-20250514` via `/ai` proxy route |
| USGS period | `/usgs` = P2D (48hr charts) · `/usgs/current` = PT3H (fast initial paint) |

**RULE: Always verify USGS gauge IDs before coding any new river. Never guess. Look them up.**

---

## Worker (`worker.js`) — current routes
- `/usgs` — fetches `00060,00065,00010` (flow, stage, water temp). Sequential fallback. P2D. 60s edge cache.
- `/usgs/current` — same but PT3H only. Used for fast first paint before chart data loads.
- `/sites` — proxies USGS site inventory by state for nationwide search. 1hr cache.
- `/ai` — proxies `api.anthropic.com/v1/messages`. Uses `env.ANTHROPIC_API_KEY`. `no-store` cache.
- All routes return `Access-Control-Allow-Origin: *`.

**Deploy worker to Cloudflare separately before pushing `index.html` to GitHub Pages.**

---

## App structure (`index.html`) — ~148k chars
Single file, all JS inline. **No ES modules.** Six tabs:

### 1. Rivers (main dashboard)
- **13 preset WA rivers** with scrollable tab strip
- **Nationwide river search** — state picker → `/sites` → type to filter → loads any US gauge via `loadCustomRiver()`
- **Stat cards**: Flow (cfs), Gauge Height (ft), Water Temp (°F — USGS `00010` or estimated), Air Temp (°F), Barometric Pressure (inHg), AI Recommended Setups
- **Wading index bar** with per-river thresholds
- **48hr flow chart** (Chart.js)
- **7-day fishing forecast** (Open-Meteo)
- **Hatch calendar** — month-aware, per-river `hatches[]` array
- **AI Insights** — `generateInsights(riverId)` — 3-4 paragraph guide report
- **AI Rig Recommendations** — `fetchWaterTemp(riverId)` — returns JSON array, renders as setup cards
- **Access points** and **Regs strip** (inline, WA rivers only)
- **Moon phase** display

### 2. Knots
- 8 knots as accordion cards (`toggleKnot(i)`)
- Each has: YouTube embed (AnimatedKnots by Grog channel), pro tip, AnimatedKnots.com link
- Confirmed video IDs:
  - Improved Clinch: `laNu2Fz_YTc`
  - Surgeon's: `VKnINpBY2gY`
  - Non-Slip Loop: `ocoILa7mL1A`
  - Blood: `L4_3RQZjePs`
  - Perfection Loop: `_xR0eLPAe8c`
  - Nail: `YE2IcxOErj8`
  - Davy: `MB5AWOuJv-s`
  - Arbor: `Ucm3cyAVtdU`

### 3. Trip Log
- localStorage key `driftscout_triplog` (implied — verify key name in code)
- Fields: date, river, flow, fly pattern, method, fish count, notes
- Functions: `saveTripEntry()`, `clearTripLog()`, `renderTripLog()`, `setDefaultDate()`
- No CSV export yet (on wish list)

### 4. Regulations
- Dropdown → renders from `const REGS` object
- 13 WA rivers covered: upperYakima, yakimaCanyon, naches, snoqualmie, methow, okanogan, klickitat, cowlitz, kalama, skykomish, wenatchee, greenRiver, stillaguamish
- Each entry: `season`, `rules[]`, `species[]`, `notes[]`, `wdfw` link, `eRegs` link

### 5. Calculator
- Tippet size → fly size chart (static table)
- Leader formula builder — `calcLeader()` (butt/mid/tippet by clarity + length)
- Hook size converter — `calcHook()`
- Split shot weight converter — `calcWeight()`

### 6. Fly Shops
- 10 WA/OR shops — `renderShops()` from `const SHOPS`
- Fields: name, location, rivers, tags[], website, phone

---

## Key state variables (global)
```js
let activeRiver    // current RIVERS[id] object
let flowData       // array of {t, v} points for chart
let currentFlow    // latest cfs (number or null)
let currentGage    // latest stage ft (number or null)
let currentWaterTemp  // °F (USGS or estimated)
let airTemp        // °F from Open-Meteo
let weatherData    // full Open-Meteo response
```

---

## Key function signatures
```js
switchRiver(riverId)           // switches active river, calls loadAll()
loadAll()                      // renders hatches/access, fetches USGS+weather, then rigs+insights
fetchUSGS(riverId)             // USGS proxy → updates flow/gage/wtemp cards + chart
fetchWeather(riverId)          // Open-Meteo → updates airtemp/baro/forecast
fetchWaterTemp(riverId)        // AI rig recommendations (JSON array)
generateInsights(riverId)      // AI fishing report (prose)
loadCustomRiver(siteId, name, lat, lon)  // nationwide search result handler
updateWading()                 // wading bar from currentFlow + activeRiver.wadingThresholds
updateConditionBanner()        // condition banner from currentFlow
renderChart()                  // Chart.js from flowData[]
renderHatches()                // hatch grid from activeRiver.hatches[]
renderForecast(daily)          // 7-day forecast from Open-Meteo daily
renderAccessPoints()           // access list from activeRiver.accessPoints[]
renderRegs()                   // regulations panel
renderKnots()                  // knot accordion (lazy, once)
renderShops()                  // fly shops (lazy, once)
saveTripEntry()                // save to localStorage
clearTripLog()                 // clear all entries
renderTripLog()                // render entries list
setDefaultDate()               // set today's date in trip form
switchMode(mode)               // top-level tab switcher
calcLeader() / calcHook() / calcWeight()  // calculator functions
```

---

## Race condition pattern (always follow)
All async functions snapshot `riverId` at the top and guard writes:
```js
async function fetchUSGS(riverId) {
  // ... fetch ...
  if (activeRiver.id !== riverId) return;  // stale — bail
  // write to DOM
}
```

---

## Verified USGS gauge IDs (WA presets)
| River | Tab ID | USGS ID |
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

## Critical bugs — never reintroduce
| Bug | Rule |
|---|---|
| **IBM Plex Mono apostrophe crash** | Never put `font-family:'IBM Plex Mono'` inside JS single-quoted strings — silently crashes entire script |
| **Inline onclick quote collision** | Never build onclick strings with quote concatenation. Use `data-*` attrs + delegated `addEventListener` |
| **USGS gauge IDs** | Never guess — always look up before coding |
| **Leaflet lazy-init** | Must init inside `initMap()`, never at parse time (not yet in app — for when Map tab is added) |
| **AI JSON parse** | Strip markdown fences before parsing: `.replace(/\`\`\`json|\`\`\`/g,'').trim()` |
| **Python heredoc `\n`** | JS `\n` inside Python-written strings must be `\\n` to avoid literal newline injection |

---

## Dev workflow (always follow)
```
1. cp /mnt/user-data/uploads/index.html /home/claude/index.html   # work from upload
2. Write /home/claude/fix.py  (Python str.replace patches — never edit HTML directly)
3. python3 /home/claude/fix.py
4. Extract script: start=c.find('<script>'); end=c.rfind('</script>'); write to /tmp/test.js
5. node --check /tmp/test.js
6. Verify brace delta == 0
7. cp /home/claude/index.html /mnt/user-data/outputs/index.html
```

---

## Wish list (not yet built)
- [ ] **⭐ My Waters** — saved/favorite rivers with live flow cards (localStorage)
- [ ] **Fishability Score card** — 0–100 score synthesizing flow + temp + hatch + baro
- [ ] **Presentation Tactics** — third AI section (technique, positioning, switch signal)
- [ ] **Match the Hatch tab** — photo upload → Claude Vision → insect ID + fly patterns
- [ ] **Map tab** — Leaflet.js with flow-colored markers for all preset gauges
- [ ] **32-state river coverage** — `STATE_RIVERS`, `STATE_SHOPS`, `STATE_REGS`
- [ ] **Regional hatch calendars** — `getFishabilityHatch()` for non-WA rivers
- [ ] **Expandable rig cards** — `leader/technique/depth/switchSignal` fields, accordion
- [ ] **Two-phase USGS load** — PT3H fast paint first, then P2D history (worker ready, app not wired)
- [ ] **PWA** — `sw.js` + `manifest.json` for installable offline shell
- [ ] **Trip Log CSV export** — `exportTripCSV()`
- [ ] **Session cache** — 5-min Map cache + background prefetch on load
- [ ] **Flow alerts on Saved Waters** — ideal cfs range, card highlights when in window
- [ ] **Knot GIF animations** — real frame-by-frame GIFs (YouTube embeds are current workaround)
- [ ] **Dynamic regulations** — AI-fetched from eregulations.com on demand

---

## Design tokens
```
--bg: #0d1117          dark navy base
--surface: #161b22     card background
--surface2: #1c2430    input/nested background
--border: #2d3748      borders
--river: #3b82f6       blue accent (chart line)
--river-dim: #1e3a5f   river muted
--green: #22c55e       good conditions
--amber: #f59e0b       caution
--red: #ef4444         poor/danger
--text: #e2e8f0        primary text
--muted: #64748b       secondary text
--accent: #7dd3fc      sky blue accent (active states, links)
--gold: #d4a853        gold (regs, warnings)

Fonts: Playfair Display (headings/italic), IBM Plex Mono (data/labels), IBM Plex Sans (body)
```
