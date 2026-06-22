export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type"
      }});
    }

    const url  = new URL(request.url);
    const path = url.pathname;
    const CORS = {
      "Content-Type":"application/json",
      "Access-Control-Allow-Origin":"*",
      "Cache-Control":"no-store"
    };

    // ── /usgs  (full 48-hr history for charts) ─────────────
    if (path === "/usgs") {
      const site = url.searchParams.get("site") || "12484500";
      const fetch1 = async (params) => {
        const u = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&period=P2D&parameterCd=${params}&siteStatus=all`;
        const r = await fetch(u, {
          headers:{"Accept":"application/json","User-Agent":"driftscout/1.0"},
          cf:{cacheTtl:60,cacheEverything:true}
        });
        try { return JSON.parse(await r.text()); } catch { return {value:{timeSeries:[]}}; }
      };
      try {
        let json = await fetch1("00060,00065,00010");
        if (!(json?.value?.timeSeries||[]).length) json = await fetch1("00060,00065");
        if (!(json?.value?.timeSeries||[]).length) json = await fetch1("00060");
        return new Response(JSON.stringify(json), { headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({value:{timeSeries:[]},error:e.message}), { headers: CORS });
      }
    }

    // ── /usgs/current  (PT3H fast paint — latest readings only) ──
    if (path === "/usgs/current") {
      const site = url.searchParams.get("site") || "12484500";
      const fetch1 = async (params) => {
        const u = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&period=PT3H&parameterCd=${params}&siteStatus=all`;
        const r = await fetch(u, {
          headers:{"Accept":"application/json","User-Agent":"driftscout/1.0"},
          cf:{cacheTtl:60,cacheEverything:true}
        });
        try { return JSON.parse(await r.text()); } catch { return {value:{timeSeries:[]}}; }
      };
      try {
        let json = await fetch1("00060,00065,00010");
        if (!(json?.value?.timeSeries||[]).length) json = await fetch1("00060,00065");
        if (!(json?.value?.timeSeries||[]).length) json = await fetch1("00060");
        return new Response(JSON.stringify(json), { headers: CORS });
      } catch(e) {
        return new Response(JSON.stringify({value:{timeSeries:[]},error:e.message}), { headers: CORS });
      }
    }

    // ── /sites  (state gauge inventory for nationwide search) ──
    if (path === "/sites") {
      const state = url.searchParams.get("state");
      if (!state) return new Response("Missing state", { status:400 });
      try {
        const u = `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${state}&siteType=ST&hasDataTypeCd=iv&siteStatus=active`;
        const r = await fetch(u, {
          headers:{"User-Agent":"driftscout/1.0"},
          cf:{cacheTtl:3600,cacheEverything:true}
        });
        return new Response(await r.text(), { headers:{
          "Content-Type":"text/plain",
          "Access-Control-Allow-Origin":"*",
          "Cache-Control":"max-age=3600"
        }});
      } catch(e) {
        return new Response("Error: "+e.message, { status:500, headers:{"Access-Control-Allow-Origin":"*"} });
      }
    }

    // ── /ai  (Anthropic proxy) ──────────────────────────────
    if (path === "/ai") {
      const body = await request.text();
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":env.ANTHROPIC_API_KEY,
          "anthropic-version":"2023-06-01"
        },
        body: body,
      });
      return new Response(await r.text(), { headers: CORS });
    }

    return new Response("OK", { status:200 });
  },
};
