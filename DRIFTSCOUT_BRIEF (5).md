# DriftScout — Project Brief
> Upload this as a Project File and paste into Project Instructions.
> Do NOT re-audit the codebase on load — trust this file and start working.

---

## Infrastructure
| Thing | Value |
|---|---|
| GitHub repo | `ljlukelj.github.io` (DriftScout folder) |
| Live URL | `https://ljlukelj.github.io/DriftScout/` |
| Cloudflare Worker | `yakima-proxy.ljlukelj.workers.dev` |
| Worker routes | `/usgs?site=` · `/usgs/current?site=` · `/sites?state=` · `/ai` |
| AI model | `claude-sonnet-4-20250514` via `/ai` proxy |
| USGS periods | `/usgs` = P2D (48hr history + chart) · `/usgs/current` = PT3H (fast initial paint) |

**GAUGE RULE: Always look up and verify USGS gauge IDs before writing any code. Never guess.**

---

## Worker (`worker.js`)
- `/usgs` — fetches `00060,00065,00010` (flow, stage, water temp). Sequential fallback. P2D. 60s edge cache.
- `/usgs/current` — same but PT3H only. Fast first paint before chart data loads.
- `/sites` — proxies USGS site inventory by state for nationwide search. 1hr cache.
- `/ai` — proxies `api.anthropic.com/v1/messages`. Uses `env.ANTHROPIC_API_KEY`. `no-store` cache.
- All routes return `Access-Control-Allow-Origin: *`.
- **Deploy worker to Cloudflare separately before pushing `index.html` to GitHub Pages.**

---

## App structure (`index.html`) — ~283k chars
Single file. All JS inline. **No ES modules.** Nine tabs.

---

### Design system
**Color palette — earth-tone parchment (light theme):**
```css
--bg: #f5f2ed          /* parchment base */
--surface: #ffffff      /* card background */
--surface2: #ede9e2     /* input/nested background */
--border: #d4cfc6       /* borders */
--river: #c8441a        /* burnt orange (chart line, primary accent) */
--river-dim: #f0ddd6    /* river muted */
--green: #3a6b35        /* good conditions */
--amber: #c07a1a        /* caution */
--red: #b83232          /* poor/danger */
--text: #1a1a17         /* primary text */
--muted: #6b6659        /* secondary text */
--accent: #c8441a       /* burnt orange (active states, links) */
--gold: #4e6b2e         /* olive green (regs, external links) */
```

**Fonts:** Playfair Display (headings + italic labels) · IBM Plex Mono (data, labels, badges) · IBM Plex Sans (body)

**Logo:** `<img src="logo.svg" class="driftscout-logo-img" alt="DriftScout">` — served as external asset. **Never alter or inline the logo.**

---

### Tab 1 — Rivers (main dashboard)
- **13 preset WA rivers** + 2 OR rivers (15 total) with scrollable tab strip
- **Nationwide river search** — state picker → `/sites` → type to filter → `loadCustomRiver(siteId, name, lat, lon)`
- **Stat cards**: Flow (cfs), Gauge Height (ft), Water Temp (°F), Air Temp (°F), Barometric Pressure (inHg), AI Recommended Setups
- **Wading index bar** with per-river `wadingThresholds`
- **48hr flow chart** (Chart.js, burnt orange line)
- **7-day fishing forecast** (Open-Meteo)
- **Hatch calendar** — month-aware, per-river `hatches[]` array
- **AI Insights** — `generateInsights(riverId)` — 3-4 paragraph guide report
- **AI Rig Recommendations** — `fetchWaterTemp(riverId)` — JSON array → setup cards
- **Access points** and inline **Regs strip** (WA preset rivers only)
- **Moon phase** in header meta

### Tab 2 — Lakes (stillwater)
- Stillwater/lake fishing content
- Separate from rivers dashboard

### Tab 3 — Knots
- 8 knots, accordion cards (`toggleKnot(i)`)
- YouTube embeds (AnimatedKnots by Grog channel) + strength % + pro tip + link
- **Confirmed video IDs:**
  - Improved Clinch: `laNu2Fz_YTc` · Surgeon's: `VKnINpBY2gY` · Non-Slip Loop: `ocoILa7mL1A`
  - Blood: `L4_3RQZjePs` · Perfection Loop: `_xR0eLPAe8c` · Nail: `YE2IcxOErj8`
  - Davy: `MB5AWOuJv-s` · Arbor: `Ucm3cyAVtdU`

### Tab 4 — Trip Log
- localStorage. Functions: `saveTripEntry()`, `clearTripLog()`, `renderTripLog()`, `setDefaultDate()`
- Fields: date, river, flow, fly pattern, method, fish count, notes
- No CSV export yet (wish list)

### Tab 5 — Regulations
- `renderRegs()` from `const REGS`, keyed by river ID
- 13 WA rivers. Each: `season`, `rules[]`, `species[]`, `notes[]`, `wdfw` URL, `eRegs` URL

### Tab 6 — Calculator
- `calcLeader()` — butt/mid/tippet by length + clarity
- `calcHook()` — hook size → tippet + use
- `calcWeight()` — split shot weight + depth
- Static tippet-to-fly-size reference table

### Tab 7 — Fly Shops
- `renderShops()` from `const SHOPS` — 10 WA/OR shops

### Tab 8 — Match the Hatch
- Photo upload → Claude Vision → insect ID + fly pattern recommendations
- Uses `hatch-preview-img` element for photo preview
- AI call via `/ai` proxy with image base64

### Tab 9 — Map
- Leaflet.js map (`initMap()`) — lazy initialized, never at parse time
- Flow-colored markers for all preset gauges

---

## Key global state
```js
let activeRiver       // RIVERS[id] object
let flowData          // [{t, v}] — 48hr chart points
let currentFlow       // number|null — latest cfs
let currentGage       // number|null — latest stage ft
let currentWaterTemp  // number|null — °F (USGS or estimated)
let airTemp           // number|null — °F from Open-Meteo
let weatherData       // full Open-Meteo response
```

## Key functions
```js
switchRiver(riverId)                       // set activeRiver, call loadAll()
loadAll()                                  // render hatches/access, fetch USGS+weather, then AI
fetchUSGS(riverId)                         // → flow/gage/wtemp cards + flowData + chart
fetchWeather(riverId)                      // → airtemp/baro/forecast
fetchWaterTemp(riverId)                    // → AI rig JSON → setup cards
generateInsights(riverId)                  // → AI prose report
loadCustomRiver(siteId, name, lat, lon)    // nationwide search → sets activeRiver + loadAll
updateWading()                             // wading bar from currentFlow + wadingThresholds
updateConditionBanner()                    // banner from currentFlow
renderChart()                              // Chart.js from flowData[]
renderHatches()                            // from activeRiver.hatches[]
renderForecast(daily)                      // 7-day from Open-Meteo
renderAccessPoints()                       // from activeRiver.accessPoints[]
renderRegs()                               // regulations panel
renderKnots()                              // lazy — renders once
renderShops()                              // lazy — renders once
initMap()                                  // lazy Leaflet init
saveTripEntry()                            // save to localStorage
clearTripLog() / renderTripLog()           // trip log management
setDefaultDate()                           // today's date in trip form
switchMode(mode)                           // top-level tab switcher
calcLeader() / calcHook() / calcWeight()   // calculator tab
```

## Race condition pattern — always follow
```js
async function fetchUSGS(riverId) {
  // ... await fetch ...
  if (activeRiver.id !== riverId) return;  // stale — bail
  // write to DOM
}
```

---

## Verified USGS gauge IDs (WA presets)
| River | Tab ID | USGS |
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
| **Python heredoc `\n` injection** | JS `\n` inside Python-written strings must be `\\n` |
| **USGS gauge IDs** | Never guess — always look up |
| **AI JSON parse** | Strip fences before parsing: `.replace(/```json\|```/g,'').trim()` |
| **Leaflet lazy-init** | Must init inside `initMap()`, never at parse time |
| **Logo** | Never alter `logo.svg` or inline it — always `<img src="logo.svg">` |

---

## Dev workflow
```
1. cp /mnt/user-data/uploads/index.html /home/claude/index.html
2. Write /home/claude/fix.py  (Python str.replace patches — never edit HTML directly)
3. python3 /home/claude/fix.py
4. Extract JS: start=c.find('<script>'); end=c.rfind('</script>'); write to /tmp/test.js
5. node --check /tmp/test.js
6. Verify brace delta == 0
7. cp /home/claude/index.html /mnt/user-data/outputs/index.html
```

---

## Wish list (not yet built)
- [ ] **⭐ My Waters** — saved/favorite rivers with live flow cards (localStorage)
- [ ] **Fishability Score card** — 0–100 from flow + temp + hatch + baro
- [ ] **Presentation Tactics** — `generateTactics()` — third AI section: technique, positioning, switch trigger
- [ ] **Two-phase USGS load** — wire PT3H fast paint → P2D history (worker ready, app not wired)
- [ ] **32-state river coverage** — `STATE_RIVERS`, `STATE_SHOPS`, `STATE_REGS`
- [ ] **Regional hatch calendars** — `getFishabilityHatch()` for non-WA rivers
- [ ] **Expandable rig cards** — `leader/technique/depth/switchSignal` accordion fields
- [ ] **PWA** — `sw.js` + `manifest.json` for installable offline shell
- [ ] **Trip Log CSV export** — `exportTripCSV()`
- [ ] **Session cache** — 5-min cache + background prefetch on load
- [ ] **Flow alerts** — ideal cfs range on saved rivers, highlight when in window
- [ ] **Knot GIF animations** — real GIFs (YouTube embeds are current workaround)
- [ ] **Dynamic regulations** — AI-fetched from eregulations.com on demand
