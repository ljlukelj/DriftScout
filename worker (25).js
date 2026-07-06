// DriftScout Worker — migrated to api.waterdata.usgs.gov (July 2026)
//
// USGS decommissioned the legacy waterservices.usgs.gov /nwis/iv and /nwis/site
// endpoints (returning HTTP 400 as of this migration). This worker now calls the
// new OGC-API-based Water Data APIs and reshapes the response back into the same
// legacy `{ value: { timeSeries: [...] } }` / RDB-tab-text shapes that index.html
// already parses, so the frontend did not need to change.
//
// STRONGLY RECOMMENDED: sign up for a free API key at
// https://api.waterdata.usgs.gov/signup/ and set it as a Cloudflare secret named
// USGS_API_KEY (wrangler secret put USGS_API_KEY). Anonymous requests are rate
// limited hard by USGS; a key raises that limit substantially.

const USGS_API_BASE = "https://api.waterdata.usgs.gov/ogcapi/v0/collections";

const STATE_NAMES = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",
  OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",
  SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type" } });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const CORS_JSON = { "Content-Type":"application/json","Access-Control-Allow-Origin":"*","Cache-Control":"public, max-age=60" };
    const CORS_TXT  = { "Content-Type":"text/plain","Access-Control-Allow-Origin":"*","Cache-Control":"public, max-age=3600" };
    const CORS_AI   = { "Content-Type":"application/json","Access-Control-Allow-Origin":"*","Cache-Control":"no-store" };

    // ── Fetch one parameter's observations for a site from the new API ──
    async function fetchParam(site, parameterCode, mode) {
      const collection = mode === "current" ? "latest-continuous" : "continuous";
      let u = `${USGS_API_BASE}/${collection}/items?f=json&monitoring_location_id=USGS-${site}&parameter_code=${parameterCode}&limit=500`;
      if (mode !== "current") {
        const end = new Date();
        const start = new Date(end.getTime() - 48 * 3600 * 1000);
        u += `&datetime=${encodeURIComponent(start.toISOString() + "/" + end.toISOString())}`;
      }
      if (env.USGS_API_KEY) u += `&api_key=${env.USGS_API_KEY}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const r = await fetch(u, {
          signal: controller.signal,
          headers: { "Accept":"application/json","User-Agent":"driftscout/1.0" },
          cf: { cacheTtl: 60, cacheEverything: true }
        });
        clearTimeout(timer);
        const text = await r.text();
        if (!text || !text.startsWith("{")) return { features: [], _status: r.status };
        const json = JSON.parse(text);
        return { features: json.features || [], _status: r.status };
      } catch (e) {
        clearTimeout(timer);
        return { features: [], _err: e.name };
      }
    }

    // ── Reshape new-API features into the legacy `value.timeSeries[]` format ──
    function toLegacyShape(paramFeatureMap) {
      const timeSeries = [];
      for (const code of Object.keys(paramFeatureMap)) {
        const feats = paramFeatureMap[code];
        const values = feats
          .map(f => ({
            value: String(f.properties?.value ?? ""),
            dateTime: f.properties?.time,
            qualifiers: f.properties?.qualifier || []
          }))
          .filter(v => v.value !== "" && v.value !== "null" && v.dateTime && !Number.isNaN(parseFloat(v.value)))
          .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
        if (!values.length) continue;
        timeSeries.push({
          variable: { variableCode: [{ value: code }] },
          values: [{ value: values }]
        });
      }
      return { value: { timeSeries } };
    }

    async function fetchUSGSData(site, mode) {
      const codes = ["00060", "00065", "00010"];
      const results = await Promise.all(codes.map(c => fetchParam(site, c, mode)));
      const paramFeatureMap = {};
      results.forEach((res, i) => { paramFeatureMap[codes[i]] = res.features; });
      return toLegacyShape(paramFeatureMap);
    }

    // Full 48hr data (chart)
    if (path === "/usgs") {
      const site = url.searchParams.get("site") || "12484500";
      try {
        const json = await fetchUSGSData(site, "full");
        return new Response(JSON.stringify(json), { headers: CORS_JSON });
      } catch (e) {
        return new Response(JSON.stringify({ value:{timeSeries:[]}, error:e.message }), { headers: CORS_JSON });
      }
    }

    // Fast snapshot for initial paint
    if (path === "/usgs/current") {
      const site = url.searchParams.get("site") || "12484500";
      try {
        const json = await fetchUSGSData(site, "current");
        return new Response(JSON.stringify(json), { headers: CORS_JSON });
      } catch (e) {
        return new Response(JSON.stringify({ value:{timeSeries:[]}, error:e.message }), { headers: CORS_JSON });
      }
    }

    // Nationwide site search — returns tab-delimited text matching the old RDB
    // column layout the frontend already parses: c[1]=site_no c[2]=name c[4]=lat c[5]=lon
    if (path === "/sites") {
      const stateAbbr = url.searchParams.get("state");
      if (!stateAbbr) return new Response("Missing state", { status:400, headers:{"Access-Control-Allow-Origin":"*"} });
      const stateName = STATE_NAMES[stateAbbr.toUpperCase()];
      if (!stateName) return new Response("Unknown state code", { status:400, headers:{"Access-Control-Allow-Origin":"*"} });

      try {
        let u = `${USGS_API_BASE}/monitoring-locations/items?f=json&state_name=${encodeURIComponent(stateName)}&site_type=Stream&limit=5000`;
        if (env.USGS_API_KEY) u += `&api_key=${env.USGS_API_KEY}`;
        const r = await fetch(u, { headers:{"User-Agent":"driftscout/1.0"}, cf:{cacheTtl:3600,cacheEverything:true} });
        const text = await r.text();
        if (!text || !text.startsWith("{")) {
          return new Response("", { headers: CORS_TXT });
        }
        const json = JSON.parse(text);
        const feats = json.features || [];
        const lines = feats.map(f => {
          const p = f.properties || {};
          const siteNo = (p.monitoring_location_id || "").replace(/^USGS-/, "");
          const name = p.monitoring_location_name || "";
          const lon = f.geometry?.coordinates?.[0] ?? "";
          const lat = f.geometry?.coordinates?.[1] ?? "";
          if (!siteNo || !name) return null;
          return `USGS\t${siteNo}\t${name}\tST\t${lat}\t${lon}`;
        }).filter(Boolean);
        return new Response(lines.join("\n"), { headers: CORS_TXT });
      } catch (e) {
        return new Response("Error: " + e.message, { status:500, headers:{"Access-Control-Allow-Origin":"*"} });
      }
    }

    if (path === "/ai") {
      const body = await request.text();
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
        body: body,
      });
      return new Response(await r.text(), { headers: CORS_AI });
    }

    return new Response("DriftScout Worker OK", { status:200 });
  },
};
