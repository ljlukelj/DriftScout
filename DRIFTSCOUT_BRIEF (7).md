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
| USGS data source | **`api.waterdata.usgs.gov` (OGC API)** — migrated July 2026, see below |

**GAUGE RULE: Always look up and verify USGS gauge IDs before writing any code. Never guess.**

---

## ⚠️ CRITICAL: USGS legacy API decommission (July 2026)

USGS shut off `waterservices.usgs.gov` (`/nwis/iv`, `/nwis/site`) — the endpoints the
worker originally used. Confirmed by direct testing: every request to those legacy
endpoints now returns HTTP 400, for every gauge, not just one river. **This was the
root cause of Yakima Canyon showing no data and other rivers showing N/A** — it was
never a DriftScout logic bug.

`worker.js` has been migrated to the new `api.waterdata.usgs.gov` OGC API:
- `/usgs` and `/usgs/current` now call the `continuous` / `latest-continuous`
  collections, fetching `00060` (flow), `00065` (gage height), `00010` (water temp)
  as three parallel requests per call, then **reshape the response back into the
  legacy `{ value: { timeSeries: [...] } }` shape** so `index.html`'s parsing code
  did not need to change.
- `/sites` now calls the `monitoring-locations` collection filtered by `state_name`
  (full name, mapped from the 2-letter code the frontend sends) and returns
  tab-delimited text matching the old RDB column layout the frontend already parses.
- **Action needed:** sign up for a free API key at `https://api.waterdata.usgs.gov/signup/`
  and set it as a Cloudflare secret named `USGS_API_KEY`
  (`wrangler secret put USGS_API_KEY`). Anonymous requests to the new API are rate
  limited hard by USGS ("a few queries per hour" per their docs) — a key raises
  that limit substantially and is effectively required for production use with
  more than one visitor.
- Deployed worker file: see latest `worker.js` in outputs. Verify Yakima Canyon and
  a handful of other WA presets live after deploying before moving on to other work.

---

## Worker (`worker.js`)
- `/usgs` — fetches `00060,00065,00010` via new `continuous` collection, 48hr range. 60s edge cache.
- `/usgs/current` — same via `latest-continuous` collection (most recent value only). Fast first paint.
- `/sites` — proxies `monitoring-locations` collection by state for nationwide search. 1hr cache.
- `/ai` — proxies `api.anthropic.com/v1/messages`. Uses `env.ANTHROPIC_API_KEY`. `no-store` cache.
- All routes return `Access-Control-Allow-Origin: *`.
- **Deploy worker to Cloudflare separately before pushing `index.html` to GitHub Pages.**

---

## App structure (`index.html`) — ~307k chars
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
- **⭐ My Waters** — saved-rivers strip at the very top of the Rivers tab, above the
  nationwide search box. `localStorage` key `driftscout_saved_waters`. A
  "☆ Save This Water" button lives in the header title block next to the river
  subtitle; toggles to "★ Saved" via `toggleSaveWater()`. Each saved card shows a
  live flow reading (fetched independently via `/usgs/current`) and a wading-color
  dot (green/amber/red from that river's `wadingThresholds`). Cards are clickable to
  jump straight to that river; a small ✕ removes it. Works for both preset rivers
  and custom nationwide-search rivers. Functions: `getSavedWaters()`,
  `setSavedWaters()`, `isWaterSaved()`, `toggleSaveWater()`, `removeSavedWater()`,
  `selectSavedWater()`, `renderMyWaters()`, `updateSaveButton()`. Hooked into
  `switchRiver()`, `loadCustomRiver()`, and initial boot.
- **13 preset WA rivers** + 2 OR rivers (15 total) with scrollable tab strip
- **Nationwide river search** — state picker → `/sites` → type to filter → `loadCustomRiver(siteId, name, lat, lon)`
- **Stat cards**: Flow (cfs), Gauge Height (ft), Water Temp (°F), Air Temp (°F), Barometric Pressure (inHg), AI Recommended Setups
- **Fishability Score card** (`calcFishabilityScore()`) — composite 0–100 score, animated SVG arc, per-factor breakdown
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
- **No search/filter yet** — open wish-list item, same nationwide-search pattern as rivers could be reused

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
- **Not yet built:** per-state/per-county regulation structure for the other 49 states.
  This is a large data-sourcing effort, not a quick patch — treat as its own
  multi-session buildout when picked up.

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
getSavedWaters() / setSavedWaters()        // My Waters localStorage read/write
toggleSaveWater() / removeSavedWater()     // My Waters save/unsave
selectSavedWater()                         // My Waters card click → jump to river
renderMyWaters() / updateSaveButton()      // My Waters render + star button state
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
| **USGS legacy API is dead** | `waterservices.usgs.gov` (`/nwis/iv`, `/nwis/site`) returns HTTP 400 as of July 2026. All USGS calls must go through `api.waterdata.usgs.gov` (OGC API) via the worker. Never add new code that calls `waterservices.usgs.gov` directly. |
| **IBM Plex Mono apostrophe crash** | Never put `font-family:'IBM Plex Mono'` inside JS single-quoted strings — silently crashes entire script |
| **Inline onclick quote collision** | Never build onclick strings with quote concatenation. Use `data-*` attrs + delegated `addEventListener` |
| **Python heredoc `\n` injection** | JS `\n` inside Python-written strings must be `\\n` |
| **USGS gauge IDs** | Never guess — always look up |
| **AI JSON parse** | Strip fences before parsing: `.replace(/```json\|```/g,'').trim()` |
| **Leaflet lazy-init** | Must init inside `initMap()`, never at parse time |
| **Logo** | Never alter `logo.svg` or inline it — always `<img src="logo.svg">` |
| **Brief accuracy** | A past brief claimed "My Waters" was built and confirmed when it was not actually present in the shipped `index.html`. Before marking anything "confirmed built," grep the actual uploaded file — don't trust prior session notes alone. |

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
- [ ] **Lakes tab search** — no state/filter search on the stillwater tab; reuse the rivers nationwide-search pattern
- [ ] **Presentation Tactics** — `generateTactics()` — third AI section: technique, positioning, switch trigger
- [ ] **32-state river coverage** — `STATE_RIVERS`, `STATE_SHOPS`, `STATE_REGS`
- [ ] **Regional hatch calendars** — `getFishabilityHatch()` for non-WA rivers
- [ ] **Expandable rig cards** — `leader/technique/depth/switchSignal` accordion fields
- [ ] **PWA** — `sw.js` + `manifest.json` for installable offline shell
- [ ] **Trip Log CSV export** — `exportTripCSV()`
- [ ] **Session cache** — 5-min cache + background prefetch on load
- [ ] **Flow alerts** — ideal cfs range on saved rivers, highlight when in window
- [ ] **Knot GIF animations** — real GIFs (YouTube embeds are current workaround)
- [ ] **Dynamic regulations** — per-state/county regs, AI-fetched or sourced from official state agencies on demand (large effort — see Tab 5 note above)
- [ ] **Tributary/small-water gauges** — e.g. Teanaway, Swauk, Taneum. Some may lack continuous USGS gauges entirely; verify per GAUGE RULE before adding, and flag any that must be estimated from a nearby mainstem gauge rather than shown as live.
