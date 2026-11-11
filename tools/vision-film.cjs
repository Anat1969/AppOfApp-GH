// The vision film of the home page (Anat, 2026-11-11: "החזון סרטון בדף הבית מעורר השראה ... מראייה כוללת שלו למקרה
// פרטי. על ידי שימוש בכל דפי הבית. 20 שניות קול של אברי במהירות 1.2").
//
//   node tools/vision-film.cjs docs/vision-film.json <outPrefix> <templatesDir> [--upload]
//
// templatesDir holds tts.py and music.py (Claude-GH, .claude/skills/anat-design-language/templates).
// The film is not a screen recording. It is drawn from the portfolio itself: the home page of every app (its cover),
// in four moves: the vision (a wall of home pages), the goal (all of them, counted), the tool (they fall into the map,
// field by result, and the empty cells show), one case (a single home page comes forward). Every frame is a pure
// function of time and is photographed one by one, so nothing drops and the film is the same on every run.
// Narration: one sentence per move, each starts when its picture starts. Speed is set at playback (data.demo.speed).
// Output: <outPrefix>.mp4, <outPrefix>-poster.jpg. With --upload: aoa-media/<appId>/demo-<ts>.mp4 and data.demo.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const SB = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
const KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
const W = 1280, H = 720, FPS = 30;
const ACTIONS = [['diagnose', 'אבחון'], ['create', 'יצירה'], ['explore', 'חקירה'], ['manage', 'ניהול'], ['inspire', 'השראה'], ['teach', 'הוראה'], ['play', 'משחק'], ['distill', 'זיקוק'], ['decide', 'החלטה']];

const rest = async (q) => (await fetch(`${SB}/rest/v1/${q}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } })).json();
const edit = async (action, payload) => {
  const r = await fetch(`${SB}/functions/v1/aoa-edit`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ action, ...payload }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `aoa-edit ${r.status}`);
  return d;
};
const probe = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

(async () => {
  const [scriptFile, out, templates, flag] = process.argv.slice(2);
  if (!scriptFile || !out || !templates) { console.error('usage: node tools/vision-film.cjs <script.json> <outPrefix> <templatesDir> [--upload]'); process.exit(2); }
  const sc = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));

  // 1. The portfolio: every app, its place on the map and its home page as a small picture.
  const rows = await rest('aoa_apps?select=id,data');
  const domains = await rest('aoa_facets?select=value,label&kind=eq.domain&order=position');
  const apps = [];
  for (const r of rows) {
    const d = r.data;
    let img = '';
    if (d.coverImage) {
      try {
        const buf = Buffer.from(await (await fetch(d.coverImage)).arrayBuffer());
        img = 'data:image/jpeg;base64,' + (await sharp(buf, { failOn: 'none' }).resize(348, 218, { fit: 'cover', position: 'top' }).flatten({ background: '#fff' }).jpeg({ quality: 78 }).toBuffer()).toString('base64');
      } catch { /* a cover that does not open: the tile shows the name */ }
    }
    apps.push({ id: r.id, name: d.name || '', action: d.action || '', domain: (d.domains || [])[0] || '', img });
  }
  const hero = rows.find((r) => r.id === sc.case);
  if (!hero) throw new Error(`case app ${sc.case} is not in the portfolio`);
  const heroBuf = Buffer.from(await (await fetch(hero.data.coverImage)).arrayBuffer());
  const heroImg = 'data:image/jpeg;base64,' + (await sharp(heroBuf).resize(1280).jpeg({ quality: 88 }).toBuffer()).toString('base64');
  console.log(`${apps.length} apps, ${apps.filter((a) => a.img).length} home pages`);

  // 2. Narration first: each move lasts as long as its sentence, and the whole film ends at sc.seconds.
  const says = sc.scenes.map((s, i) => {
    const f = path.join(dir, `v${i}.mp3`);
    execFileSync('python3', ['-I', path.join(templates, 'tts.py'), sc.voice, f, s.say, '+0%']);
    return { file: f, dur: probe(f) - 0.8 }; // the voice file ends with about 0.8s of silence
  });
  const starts = [0];
  const voiceAt = [0.6];
  for (let i = 1; i < says.length; i++) {
    voiceAt[i] = voiceAt[i - 1] + says[i - 1].dur + 0.7;
    starts[i] = voiceAt[i] - 0.35;
  }
  const end = Math.max(sc.seconds, voiceAt.at(-1) + says.at(-1).dur + 1.4);
  // Spare time goes to the single case: it is the move the eye needs longest.
  const spare = sc.seconds - (voiceAt.at(-1) + says.at(-1).dur + 1.7);
  if (spare > 0) { voiceAt[4] += spare; starts[4] += spare; }
  console.log('scenes start at', starts.map((x) => x.toFixed(1)).join(', '), 'end', end.toFixed(1));

  // 3. The picture.
  const html = `<!doctype html><html lang="he"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Hebrew:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
#map,#case,#kick,#head,#band,#close{direction:rtl}
body{width:${W}px;height:${H}px;overflow:hidden;background:#0b1f3a;font-family:"IBM Plex Sans Hebrew",Arial,sans-serif;color:#fff}
#wall{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
.t{position:absolute;left:0;top:0;width:87px;height:54px;transform-origin:0 0;background:#1c2a44 center top/cover;box-shadow:0 1px 4px rgba(0,0,0,.45);overflow:hidden}
.t span{position:absolute;inset:0;display:grid;place-items:center;font-size:9px;text-align:center;padding:4px;color:#cdd5e3}
#shade{position:absolute;inset:0;background:#0b1f3a}
#map{position:absolute;inset:0}
.col,.row{position:absolute;font-size:14px;font-weight:600;color:#fff;white-space:nowrap}
.col{text-align:center;top:34px}
.row{text-align:right;font-weight:400;color:#e6ebf3;font-size:13.5px}
.gap{position:absolute;border:1px dashed #f2b705}
#kick{position:absolute;top:26px;right:40px;font-family:"IBM Plex Mono",monospace;font-size:15px;letter-spacing:.14em;color:#f2b705}
#head{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-size:62px;font-weight:700;line-height:1.2;text-shadow:0 2px 24px rgba(11,31,58,.9)}
#band{position:absolute;left:0;right:0;bottom:0;height:128px;background:linear-gradient(to top,#0b1f3a 62%,rgba(11,31,58,0));display:flex;align-items:flex-end;justify-content:center;gap:22px;padding:0 40px 26px}
#num{font-size:76px;font-weight:700;color:#f2b705;line-height:.9;font-variant-numeric:tabular-nums}
#line{font-size:38px;font-weight:700;white-space:nowrap;padding-bottom:4px}
#hero{position:absolute;left:0;top:0;transform-origin:0 0;width:720px;height:450px;background:#fff center top/cover;box-shadow:0 18px 60px rgba(0,0,0,.6);outline:1px solid rgba(255,255,255,.35)}
#case{position:absolute;right:40px;top:178px;width:480px;text-align:right}
#case .a{font-family:"IBM Plex Mono",monospace;font-size:14px;letter-spacing:.12em;color:#f2b705}
#case .q{font-size:38px;font-weight:700;line-height:1.18;margin:14px 0 18px;white-space:nowrap}
#case .n{font-size:21px;font-weight:600;border-top:2px solid #f2b705;padding-top:14px}
#case .w{font-size:17px;color:#cdd5e3;margin-top:6px}
#close{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:14px}
#close .big{font-size:66px;font-weight:700}
#close .bar{width:120px;height:4px;background:#f2b705;margin:6px auto 10px}
#close .ti{font-size:27px;font-weight:600}
#close .u{font-family:"IBM Plex Mono",monospace;font-size:19px;color:#f2b705;direction:ltr}
#close .o{font-size:16px;color:#cdd5e3}
</style></head><body>
<div id="wall"></div><div id="shade"></div><div id="map"></div><div id="hero"></div>
<div id="case"><div class="a"></div><div class="q"></div><div class="n"></div><div class="w">כלי אחד עונה.</div></div>
<div id="kick"></div><div id="head"></div><div id="band"><div id="line"></div><div id="num"></div></div>
<div id="close"><div class="big"></div><div class="bar"></div><div class="ti"></div><div class="u"></div><div class="o"></div></div>
<script>
const D = ${JSON.stringify({ apps: apps.map(({ img, ...a }) => a), domains, actions: ACTIONS, sc, starts, heroId: sc.case })};
const IMG = ${JSON.stringify(apps.map((a) => a.img))};
const $ = (s) => document.querySelector(s);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t, a, d) => ease((t - a) / d);
const N = D.apps.length;
// the wall: 14 x 12, every home page at 87 x 54
const COLS = 14, CW = ${W} / COLS, RH = ${H} / 12;
// the map: field (rows) by result (columns), right to left
const GX = 30, GW = 1070, GY = 64, CELLW = GW / D.actions.length, CELLH = 40;
const cells = {};
const tiles = D.apps.map((a, k) => {
  const el = document.createElement('div');
  el.className = 't';
  if (IMG[k]) el.style.backgroundImage = 'url(' + IMG[k] + ')'; else el.innerHTML = '<span>' + a.name + '</span>';
  $('#wall').append(el);
  const w = { x: (COLS - 1 - (k % COLS)) * CW + 2, y: Math.floor(k / COLS) * RH + 3 };
  const j = D.actions.findIndex((x) => x[0] === a.action), i = D.domains.findIndex((x) => x.value === a.domain);
  let m = null;
  if (i >= 0 && j >= 0) {
    const key = i + ':' + j, n = (cells[key] = (cells[key] || 0) + 1) - 1;
    m = { x: GX + GW - (j + 1) * CELLW + 2 + (n % 4) * 29 + Math.floor(n / 8) * 3, y: GY + i * CELLH + 2 + (Math.floor(n / 4) % 2) * 18.5, s: 27 / 87 };
  }
  return { el, w, m, hero: a.id === D.heroId, order: (k * 37) % N };
});
D.actions.forEach((a, j) => { const e = document.createElement('div'); e.className = 'col'; e.textContent = a[1]; e.style.cssText = 'left:' + (GX + GW - (j + 1) * CELLW) + 'px;width:' + CELLW + 'px'; $('#map').append(e); });
D.domains.forEach((d, i) => { const e = document.createElement('div'); e.className = 'row'; e.textContent = d.label; e.style.cssText = 'right:24px;width:150px;top:' + (GY + i * CELLH + 11) + 'px'; $('#map').append(e); });
const gaps = [];
D.domains.forEach((d, i) => D.actions.forEach((a, j) => { if (!cells[i + ':' + j]) { const e = document.createElement('div'); e.className = 'gap'; e.style.cssText = 'left:' + (GX + GW - (j + 1) * CELLW + 3) + 'px;top:' + (GY + i * CELLH + 3) + 'px;width:' + (CELLW - 6) + 'px;height:' + (CELLH - 6) + 'px'; $('#map').append(e); gaps.push(e); } }));
const heroT = tiles.find((x) => x.hero), heroA = D.apps.find((a) => a.id === D.heroId);
$('#hero').style.backgroundImage = 'url(${heroImg})';
$('#case .a').textContent = (D.actions.find((x) => x[0] === heroA.action) || ['', ''])[1] + ' · ' + ((D.domains.find((x) => x.value === heroA.domain) || {}).label || '');
$('#case .q').textContent = D.sc.scenes[3].line;
$('#case .n').textContent = heroA.name;
$('#close .big').textContent = D.sc.scenes[4].line;
$('#close .ti').textContent = D.sc.title;
$('#close .u').textContent = D.sc.url;
$('#close .o').textContent = D.sc.owner;
window.GAPS = gaps.length;

window.render = (t) => {
  const [a1, a2, a3, a4, a5] = D.starts;
  const out = seg(t, a2 - 0.2, 2.2);            // the camera pulls back from a few home pages to all of them
  const s = 3 - 2 * out, cx = 640 + (1 - out) * (-150 + t * 16), cy = 360 + (1 - out) * (60 - t * 7);
  $('#wall').style.transform = 'translate(' + (640 - cx * s) + 'px,' + (360 - cy * s) + 'px) scale(' + s + ')';
  const caseIn = seg(t, a4, 0.7), closing = seg(t, a5, 0.7);
  for (const k of tiles) {
    const m = k.m ? seg(t, a3 + 0.15 + k.order * 0.005, 1.3) : 0, q = k.m || k.w;
    const x = k.w.x + (q.x - k.w.x) * m, y = k.w.y + (q.y - k.w.y) * m, sc = 1 + ((k.m ? k.m.s : 1) - 1) * m;
    let o = seg(t, 0.05 + k.order * 0.006, 0.5);
    if (!k.m) o *= 1 - seg(t, a3, 0.8);          // an app with no place on the map yet steps back
    o *= 1 - 0.82 * caseIn + 0.5 * closing;
    k.el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
    k.el.style.opacity = o;
  }
  $('#shade').style.opacity = 0.42 * (1 - seg(t, a2 - 0.2, 1.6)) + 0.14 * seg(t, a2, 1) * (1 - seg(t, a3, 0.8));
  $('#map').style.opacity = seg(t, a3 + 0.7, 0.8) * (1 - 0.9 * caseIn + 0.9 * closing * caseIn);
  const pulse = 0.5 + 0.5 * Math.sin((t - a5) * 5);
  gaps.forEach((g, n) => { const on = seg(t, a3 + 1.5 + (n % 9) * 0.05, 0.6); g.style.opacity = on * (0.45 + closing * (0.3 + 0.25 * pulse)); g.style.background = 'rgba(242,183,5,' + (closing * 0.16 * pulse) + ')'; });
  // one case: the home page comes out of its cell
  const g = seg(t, a4 + 0.1, 1.1), from = heroT.m, hs = from.s * 87 / 720 + (700 / 720 - from.s * 87 / 720) * g;
  $('#hero').style.transform = 'translate(' + (from.x + (40 - from.x) * g) + 'px,' + (from.y + (140 - from.y) * g) + 'px) scale(' + hs + ')';
  $('#hero').style.opacity = seg(t, a4, 0.3) * (1 - closing);
  $('#case').style.opacity = seg(t, a4 + 0.9, 0.6) * (1 - closing);
  // words
  const i = t < a2 ? 0 : t < a3 ? 1 : t < a4 ? 2 : t < a5 ? 3 : 4;
  $('#kick').textContent = D.sc.scenes[i].stage ? '0' + (i + 1) + '  ' + D.sc.scenes[i].stage : '';
  $('#kick').style.opacity = 1 - closing;
  $('#head').textContent = D.sc.scenes[0].line;
  $('#head').style.opacity = seg(t, 0.25, 0.6) * (1 - seg(t, a2 - 0.45, 0.45));
  const band = i === 1 ? seg(t, a2 + 0.3, 0.5) * (1 - seg(t, a3 - 0.3, 0.3)) : i === 2 ? seg(t, a3 + 0.3, 0.5) * (1 - seg(t, a4 - 0.3, 0.3)) : 0;
  $('#band').style.opacity = band;
  $('#line').textContent = i === 1 || i === 2 ? D.sc.scenes[i].line : '';
  $('#num').textContent = i === 1 ? Math.round(N * seg(t, a2 + 0.3, 2)) : '';
  $('#close').style.opacity = closing;
  $('#close').style.background = 'radial-gradient(closest-side, rgba(11,31,58,.96) 55%, rgba(11,31,58,.5))';
};
</script></body></html>`;
  fs.writeFileSync(path.join(dir, 'film.html'), html);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, 'film.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  const frames = Math.round(end * FPS);
  for (let f = 0; f < frames; f++) {
    await p.evaluate((t) => window.render(t), f / FPS);
    await p.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  console.log(`${frames} frames, ${await p.evaluate(() => window.GAPS)} empty cells on the map`);
  await b.close();

  // 4. Sound: the sentences at their seconds, music under them (lowered while the voice speaks), a lift at the close.
  const music = path.join(dir, 'music.wav');
  execFileSync('python3', ['-I', path.join(templates, 'music.py'), music, String(end), sc.music || 'wonder', String(starts[4])]);
  const ins = says.flatMap((s) => ['-i', s.file]);
  const delays = says.map((s, i) => `[${i + 2}:a]adelay=${Math.round(voiceAt[i] * 1000)}:all=1[v${i}]`).join(';');
  const filter = `${delays};${says.map((_, i) => `[v${i}]`).join('')}amix=inputs=${says.length}:normalize=0,asplit[vo][key];[1:a]volume=0.5[m];[m][key]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=500[md];[vo][md]amix=inputs=2:normalize=0,afade=t=out:st=${(end - 1).toFixed(2)}:d=1[a]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg'), '-i', music, ...ins, '-filter_complex', filter, '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-t', String(end), '-movflags', '+faststart', `${out}.mp4`]);
  // The poster is the whole portfolio at one glance: every home page, counted.
  fs.copyFileSync(path.join(dir, `f${String(Math.round((starts[2] - 0.5) * FPS)).padStart(4, '0')}.jpg`), `${out}-poster.jpg`);
  const duration = probe(`${out}.mp4`);
  console.log(`${out}.mp4 ${duration.toFixed(1)}s (${(duration / sc.speed).toFixed(1)}s at x${sc.speed}), ${(fs.statSync(`${out}.mp4`).size / 1e6).toFixed(1)}MB`);

  if (flag === '--upload') {
    const ts = Date.now();
    const put = async (name, file, type) => {
      const { token, publicUrl } = await edit('sign_upload', { path: `${sc.appId}/${name}` });
      const r = await fetch(`${SB}/storage/v1/object/upload/sign/aoa-media/${sc.appId}/${name}?token=${token}`, { method: 'PUT', headers: { 'Content-Type': type, apikey: KEY }, body: fs.readFileSync(file) });
      if (!r.ok) throw new Error(`upload ${name} ${r.status}`);
      return publicUrl;
    };
    const src = await put(`demo-${ts}.mp4`, `${out}.mp4`, 'video/mp4');
    const poster = await put(`demo-poster-${ts}.jpg`, `${out}-poster.jpg`, 'image/jpeg');
    const [row] = await rest(`aoa_apps?select=data&id=eq.${sc.appId}`);
    const demo = { ...(row.data.demo || {}), src, poster, duration: Math.round(duration * 10) / 10, speed: sc.speed, whole: true, length: Math.round(duration / sc.speed), updatedAt: new Date().toISOString(),
      // Every video is made to be sent on (Anat, 2026-11-11): share turns on the "שיתוף" button and the link that opens the player.
      share: { text: sc.share || sc.scenes[0].line } };
    await edit('save_app', { id: sc.appId, data: { ...row.data, demo } });
    console.log('saved in data.demo:', src);
  }
})();
