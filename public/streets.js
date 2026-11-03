/*
 * Ashdod streets, shared by all of Anat's municipal apps (2026-11-03).
 * Source: the municipality layer rehevot.shp (Israel TM Grid), sent by Anat; the original is kept in SHIMUR-GH
 * data/gis/rehovot/. This file serves the same 2,991 segments in WGS84 (gis/ashdod-streets.geojson, next to it).
 *
 *   <script src="https://anat1969.github.io/AppOfApp-GH/streets.js"></script>   (Pages first, Vercel second)
 *   const s = await AIStreets.nearest(lat, lng)   -> { name, quarter, tier, code, metres } or null (over 60 m)
 *   const p = await AIStreets.locate('שדרות הרצל 12, אשדוד') -> { lat, lng, name, quarter, approx: 'street' } or null
 *   const geo = await AIStreets.load()               -> the GeoJSON FeatureCollection, for a map layer
 *
 * locate() finds the street, not the house: the point is the middle of that street's segments, so an app marks it as
 * approximate. No external service and no rate limit, unlike Nominatim.
 */
(function () {
  if (window.AIStreets) return;
  const me = document.currentScript;
  const DATA = new URL('gis/ashdod-streets.geojson', (me && me.src) || 'https://anat1969.github.io/AppOfApp-GH/streets.js').href;
  let cache = null;
  const load = () =>
    (cache ||= fetch(DATA).then((r) => {
      if (!r.ok) throw new Error('שכבת הרחובות לא נטענה');
      return r.json();
    }).catch((e) => { cache = null; throw e; }));

  const linesOf = (f) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates);
  const norm = (s) =>
    (s || '')
      .replace(/[׳`’']/g, "'")
      .replace(/[״"”]/g, '"')
      // street-type words, with or without a geresh: "שד הרצל" in the layer, "שדרות הרצל" in an address
      .replace(/(^|\s)(רחוב|רח'?|שדרות|שד'?|דרך|סמטת|סמ'?|כיכר|ככר)(?=\s)/g, ' ')
      .replace(/[0-9,.\-–/]+/g, ' ')
      .replace(/אשדוד/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  async function nearest(lat, lng, maxM = 60) {
    const geo = await load();
    const kx = 111320 * Math.cos((lat * Math.PI) / 180);
    const ky = 110540;
    const px = lng * kx, py = lat * ky;
    let best = null;
    for (const f of geo.features) {
      for (const line of linesOf(f)) {
        for (let i = 1; i < line.length; i++) {
          const ax = line[i - 1][0] * kx, ay = line[i - 1][1] * ky, bx = line[i][0] * kx, by = line[i][1] * ky;
          const dx = bx - ax, dy = by - ay;
          const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
          const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
          if (!best || d < best.d) best = { p: f.properties, d };
        }
      }
    }
    return best && best.d <= maxM && best.p.name ? { ...best.p, metres: Math.round(best.d) } : null;
  }

  async function locate(address) {
    const geo = await load();
    const a = ` ${norm(address)} `;
    const quarter = (address || '').match(/רובע\s+[א-ת"׳']+/)?.[0];
    // the longest street name inside the address wins ("הרצל" inside "שדרות הרצל 12")
    let name = '';
    for (const f of geo.features) {
      if (/^חני/.test(f.properties.name)) continue; // parking lots carry a street name too
      const n = norm(f.properties.name);
      if (n.length > name.length && a.includes(` ${n} `)) name = n;
    }
    if (!name) return null;
    let segs = geo.features.filter((f) => !/^חני/.test(f.properties.name) && norm(f.properties.name) === name);
    if (quarter) {
      const inQ = segs.filter((f) => f.properties.quarter === quarter);
      if (inQ.length) segs = inQ;
    }
    let sx = 0, sy = 0, n = 0;
    for (const f of segs) for (const line of linesOf(f)) for (const [x, y] of line) { sx += x; sy += y; n++; }
    const q = {};
    for (const f of segs) q[f.properties.quarter] = (q[f.properties.quarter] || 0) + 1;
    const mainQuarter = Object.entries(q).sort((x, y) => y[1] - x[1])[0]?.[0] || '';
    return { lat: sy / n, lng: sx / n, name: segs[0].properties.name, quarter: mainQuarter, approx: 'street' };
  }

  window.AIStreets = { load, nearest, locate, source: DATA };
})();
