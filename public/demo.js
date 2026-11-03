/*
 * demo.js - "סרטון הדגמה": a short demo video on the home page of every app, with length and speed
 * chosen by Anat inside the A&I (or Ashdod) logo button.
 *
 * Loaded by ai-menu.js, from the same address, so every app with the logo button has it.
 * One source of truth: the app's record in aoa_apps (Supabase cultura-GH), field data.demo:
 *   { src, poster, duration, speed, length, whole, at: ['<origin><pathname>', ...], updatedAt }
 * The video file is produced by Claude (templates/demo.cjs in Claude-GH) and lives in the aoa-media bucket.
 *
 * Length and speed are applied when the video plays, never burned into the file: a change shows at once,
 * with no new render and no deployment. With "whole" on they are one decision (length = duration / speed),
 * so the whole story, including the closing card with the address, is always seen.
 *
 * Placement: inside an element with data-aoa-demo when the page has one (the app decides where),
 * otherwise a fixed button at the bottom corner. Only on the pages listed in "at".
 *
 *   AIDemo.open()   the settings panel (from the logo button)
 */
(function () {
  if (window.AIDemo) return;
  const SB = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
  const KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  const pageKey = () => location.origin + location.pathname.replace(/index\.html?$/, '');
  const norm = (u) => { try { const x = new URL(u); return (x.origin + x.pathname.replace(/index\.html?$/, '')).replace(/\/+$/, '/'); } catch { return ''; } };
  const sameKey = (a, b) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const fmtX = (v) => `×${(+v).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;

  async function rest(path) {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY } });
    if (!r.ok) throw new Error(`שגיאה ${r.status}`);
    return r.json();
  }
  async function edit(action, payload) {
    const r = await fetch(`${SB}/functions/v1/aoa-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify({ action, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `שגיאה ${r.status}`);
    return d;
  }

  // Playback window: how much of the source is shown, and for how long.
  const plan = (d) => {
    const dur = +d.duration || 0;
    const speed = clamp(+d.speed || 1, 0.5, 3);
    const length = d.whole !== false ? dur / speed : Math.min(+d.length || dur, dur / speed);
    return { speed, length, end: Math.min(dur, length * speed), dur };
  };

  const CSS = `
    :host { all: initial; font-family: "IBM Plex Sans Hebrew", Arial, sans-serif; direction: rtl; color: #17191c; }
    *, *::before { box-sizing: border-box; }
    button { font: inherit; color: inherit; cursor: pointer; }
    .launch {
      display: inline-flex; align-items: center; gap: 12px; padding: 6px 6px 6px 14px; border: 1px solid transparent; border-radius: 0;
      background: linear-gradient(180deg, #fbfaf8, #ecebe7); text-align: right;
      box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 2px rgba(20,22,26,.08), 0 8px 20px -10px rgba(20,22,26,.4);
      transition: transform .2s, box-shadow .2s;
    }
    .launch:hover { transform: translateY(-2px); box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 2px 4px rgba(20,22,26,.1), 0 16px 30px -12px rgba(20,22,26,.5); }
    .launch:active { transform: translateY(1px); }
    .launch:focus-visible { outline: 2px solid #22324f; outline-offset: 2px; }
    .thumb { position: relative; order: 2; width: 112px; height: 70px; flex: none; background: #0b1f3a center / cover no-repeat; }
    /* Play mark in an amber square at the corner, so it never covers the title on the poster. */
    .thumb::before { content: ""; position: absolute; left: 0; bottom: 0; width: 28px; height: 28px; background: #f2b705; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
    .thumb::after { content: ""; position: absolute; left: 10px; bottom: 8px; width: 0; height: 0; border-style: solid;
      border-width: 6px 0 6px 10px; border-color: transparent transparent transparent #0b1f3a; }
    .launch:hover .thumb::before { background: #ffc61a; }
    .ltext { order: 1; display: grid; gap: 3px; }
    .ltext b { font-size: 15px; font-weight: 700; }
    .ltext small { font: 500 11.5px "IBM Plex Mono", "IBM Plex Sans Hebrew", monospace; color: #5a5f66; letter-spacing: .03em; }
    .launch.large { flex-direction: column; align-items: stretch; gap: 0; padding: 0; width: 360px; max-width: 100%; }
    .launch.large .thumb { order: 0; width: 100%; height: auto; aspect-ratio: 16 / 10; }
    .launch.large .thumb::before { width: 52px; height: 52px; }
    .launch.large .thumb::after { left: 19px; bottom: 15px; border-width: 11px 0 11px 18px; }
    .launch.large .ltext { order: 1; padding: 10px 14px 12px; grid-template-columns: 1fr auto; align-items: baseline; }
    .launch.large .ltext b { font-size: 17px; }
    .corner { position: fixed; bottom: 18px; inset-inline-end: 18px; z-index: 2147482000; }

    .veil { position: fixed; inset: 0; z-index: 2147483200; background: rgba(8,14,26,.86); display: grid; place-items: center; padding: 24px; animation: fade .2s; }
    @keyframes fade { from { opacity: 0; } }
    .stage { position: relative; width: min(1100px, 100%); background: #0b1f3a; box-shadow: 0 30px 80px rgba(0,0,0,.5); }
    .stage video { display: block; width: 100%; height: auto; max-height: calc(100vh - 140px); background: #000; }
    .bar { display: flex; align-items: center; gap: 14px; padding: 10px 14px; color: #fff; border-top: 3px solid #f2b705; }
    .track { position: relative; flex: 1; height: 4px; background: rgba(255,255,255,.22); }
    .track i { position: absolute; inset-block: 0; inset-inline-start: 0; width: 0; background: #f2b705; }
    .bar small { font: 500 12px "IBM Plex Mono", monospace; opacity: .85; white-space: nowrap; }
    .ctl { min-width: 88px; padding: 7px 12px; border: 0; border-radius: 0; background: rgba(255,255,255,.12); color: #fff; font-size: 13px; }
    .ctl:hover { background: rgba(255,255,255,.22); }
    .x { position: absolute; top: -44px; inset-inline-end: 0; width: 36px; height: 36px; border: 0; background: none; color: #fff; }
    .x::before, .x::after { content: ""; position: absolute; inset: 0; margin: auto; width: 22px; height: 2px; background: currentColor; transform: rotate(45deg); }
    .x::after { transform: rotate(-45deg); }

    .panel { position: fixed; top: 0; bottom: 0; inset-inline-start: 0; z-index: 2147483100; width: min(420px, 100vw); background: #f7f6f3;
      box-shadow: 0 0 0 1px #cfccc5, 0 24px 60px rgba(20,22,26,.3); display: flex; flex-direction: column; animation: slide .22s cubic-bezier(.2,.7,.2,1); }
    @keyframes slide { from { transform: translateX(24px); opacity: 0; } }
    .ph { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 14px; border-bottom: 1px solid #e2dfd9; }
    .ph h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .ph p { margin: 4px 0 0; font-size: 13px; color: #5a5f66; }
    .ph .x { position: relative; top: 0; color: #17191c; flex: none; }
    .pb { overflow: auto; padding: 16px 20px 24px; display: grid; gap: 18px; }
    .pv video { width: 100%; display: block; background: #0b1f3a; }
    .lab { font: 500 10.5px "IBM Plex Mono", "IBM Plex Sans Hebrew", monospace; letter-spacing: .14em; color: #6b7077; margin-bottom: 8px; }
    .chips { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .chip { padding: 8px 0; border: 1px solid transparent; border-radius: 0; background: #ebe9e4; font: 500 13px "IBM Plex Mono", monospace;
      box-shadow: 0 1px 2px rgba(20,22,26,.08); transition: transform .15s, box-shadow .15s; }
    .chip:hover { transform: translateY(-1px); box-shadow: 0 4px 10px -4px rgba(20,22,26,.35); }
    .chip[aria-pressed="true"] { background: #17191c; color: #f4f3f0; font-weight: 700; }
    .row { display: flex; align-items: center; gap: 12px; }
    input[type=range] { flex: 1; accent-color: #17191c; }
    .num { font: 700 22px "IBM Plex Mono", monospace; min-width: 64px; text-align: left; }
    .sum { padding: 10px 12px; background: #fff6d6; font-size: 13.5px; line-height: 1.45; }
    .sum b { font-weight: 700; }
    .tog { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 12px; border: 1px solid transparent;
      border-radius: 0; background: #ebe9e4; text-align: right; font-size: 14px; box-shadow: 0 1px 2px rgba(20,22,26,.08); }
    .tog small { font-size: 12px; color: #5a5f66; }
    .tog[aria-pressed="true"] { background: #17191c; color: #f4f3f0; }
    .tog[aria-pressed="true"] small { color: #b9bcc0; }
    .solid { padding: 11px 16px; border: 0; border-radius: 0; background: linear-gradient(180deg, #2a2d32, #17191c); color: #f4f3f0; font-size: 14px; font-weight: 500;
      box-shadow: 0 6px 16px -8px rgba(20,22,26,.6); }
    .solid:disabled { opacity: .45; cursor: default; }
    .ghost { padding: 10px 14px; border: 1px solid transparent; border-radius: 0; background: #ebe9e4; font-size: 13.5px; box-shadow: 0 1px 2px rgba(20,22,26,.08); }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .st { font: 500 12px "IBM Plex Mono", "IBM Plex Sans Hebrew", monospace; color: #2f5d46; }
    .st.err { color: #b3261e; }
    .empty { padding: 14px; background: #ebe9e4; font-size: 14px; line-height: 1.5; }
    .empty b { display: block; font-size: 16px; margin-bottom: 4px; }
    select { width: 100%; padding: 9px 10px; border: 1px solid #cfccc5; border-radius: 0; background: #fff; font: inherit; font-size: 14px; }
    pre { margin: 0; padding: 10px 12px; background: #fff; border: 1px solid #e2dfd9; font: 12px/1.5 "IBM Plex Mono", monospace; white-space: pre-wrap; direction: rtl; text-align: right; max-height: 160px; overflow: auto; }
    @media (prefers-reduced-motion: reduce) { .veil, .panel { animation: none; } .launch, .chip { transition: none; } }
  `;

  const host = (cls) => {
    const h = document.createElement('aoa-demo');
    if (cls) h.className = cls;
    const r = h.attachShadow({ mode: 'open' });
    r.innerHTML = `<style>${CSS}</style>`;
    return [h, r];
  };
  const el = (tag, props = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'on') for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f);
      else if (k in e && k !== 'style') e[k] = v;
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) if (c != null) e.append(c);
    return e;
  };

  // ---------- the viewer: overlay player that honours length and speed ----------
  function play(d) {
    const pl = plan(d);
    const [h, r] = host();
    const v = el('video', { src: d.src, poster: d.poster || '', playsInline: true, muted: true, preload: 'auto' });
    const fill = el('i');
    const time = el('small', { dir: 'ltr', textContent: `0:00 / ${fmt(pl.length)}` });
    const toggle = el('button', { className: 'ctl', type: 'button', textContent: 'השהיה' });
    const close = () => { removeEventListener('keydown', onKey); h.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === ' ') { e.preventDefault(); toggle.click(); } };
    const x = el('button', { className: 'x', type: 'button', title: 'סגירה', 'aria-label': 'סגירה', on: { click: close } });
    const stage = el('div', { className: 'stage', role: 'dialog', 'aria-label': 'סרטון הדגמה' }, [x, v, el('div', { className: 'bar' }, [toggle, el('div', { className: 'track' }, fill), time])]);
    const veil = el('div', { className: 'veil', on: { click: (e) => { if (e.target === veil) close(); } } }, stage);
    r.append(veil);
    document.body.append(h);
    addEventListener('keydown', onKey);
    v.addEventListener('loadedmetadata', () => { v.playbackRate = pl.speed; });
    v.addEventListener('timeupdate', () => {
      const shown = v.currentTime / pl.speed;
      fill.style.width = `${clamp((v.currentTime / pl.end) * 100, 0, 100)}%`;
      time.textContent = `${fmt(shown)} / ${fmt(pl.length)}`;
      if (pl.end && v.currentTime >= pl.end - 0.05) { v.pause(); toggle.textContent = 'שוב מההתחלה'; }
    });
    v.addEventListener('click', () => toggle.click());
    toggle.addEventListener('click', () => {
      if (v.paused) { if (v.currentTime >= pl.end - 0.1) v.currentTime = 0; v.playbackRate = pl.speed; v.play(); toggle.textContent = 'השהיה'; }
      else { v.pause(); toggle.textContent = 'המשך'; }
    });
    v.playbackRate = pl.speed;
    v.play().catch(() => { toggle.textContent = 'הפעלה'; });
    x.focus();
  }

  // ---------- the home-page button ----------
  let current = null; // { id, demo }
  let launcher = null;
  function makeLauncher(d, inSlot, large) {
    const pl = plan(d);
    const [h, r] = host(inSlot ? '' : 'corner-host');
    const thumb = el('span', { className: 'thumb' });
    if (d.poster) thumb.style.backgroundImage = `url("${d.poster}")`;
    const b = el('button', { className: `launch${inSlot ? '' : ' corner'}${large ? ' large' : ''}`, type: 'button', title: 'צפייה בסרטון ההדגמה', on: { click: () => play(current.demo) } }, [
      thumb,
      el('span', { className: 'ltext' }, [el('b', { textContent: 'סרטון הדגמה' }), el('small', { dir: 'ltr', textContent: `${fmt(pl.length)} · ${fmtX(pl.speed)}` })]),
    ]);
    r.append(b);
    h.dataset.slot = inSlot ? '1' : '';
    return h;
  }
  function mount() {
    const d = current && current.demo;
    const want = d && d.src && (d.at || []).some((k) => sameKey(k, pageKey()));
    const slot = document.querySelector('[data-aoa-demo]');
    if (!want) { launcher?.remove(); launcher = null; return; }
    const inSlot = !!slot;
    // An app that has slots shows the button only where the slot is (its home page), never in the corner of other views.
    if (!inSlot && document.documentElement.hasAttribute('data-aoa-demo-slots')) { launcher?.remove(); launcher = null; return; }
    if (launcher && launcher.isConnected && (inSlot ? slot.contains(launcher) : !launcher.dataset.slot)) return;
    launcher?.remove();
    launcher = makeLauncher(d, inSlot, inSlot && slot.dataset.aoaDemo === 'large');
    (inSlot ? slot : document.body).append(launcher);
  }
  let queued = false;
  const remount = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mount(); }); };

  async function load() {
    try {
      const key = pageKey();
      const keys = [key, key.replace(/\/+$/, ''), key.endsWith('/') ? key : key + '/'];
      for (const k of [...new Set(keys)]) {
        const rows = await rest(`aoa_apps?select=id,demo:data->demo&data->demo->at=cs.${encodeURIComponent(JSON.stringify([k]))}&limit=1`);
        if (rows[0] && rows[0].demo && rows[0].demo.src) { current = { id: rows[0].id, demo: rows[0].demo }; break; }
      }
    } catch {}
    mount();
    new MutationObserver(remount).observe(document.body, { childList: true, subtree: true });
    addEventListener('popstate', remount);
    addEventListener('hashchange', remount);
  }

  // ---------- the settings panel (inside the logo button) ----------
  let panelHost = null;
  async function open() {
    panelHost?.remove();
    const [h, r] = host();
    panelHost = h;
    const close = () => { h.remove(); panelHost = null; removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', onKey);
    const body = el('div', { className: 'pb' }, el('div', { className: 'empty', textContent: 'טוען...' }));
    r.append(el('aside', { className: 'panel', role: 'dialog', 'aria-label': 'סרטון הדגמה' }, [
      el('div', { className: 'ph' }, [
        el('div', {}, [el('h2', { textContent: 'סרטון הדגמה' }), el('p', { textContent: 'כפתור בדף הבית שמראה את האפליקציה בפעולה. אורך ומהירות נקבעים כאן.' })]),
        el('button', { className: 'x', type: 'button', title: 'סגירה', 'aria-label': 'סגירה', on: { click: close } }),
      ]),
      body,
    ]));
    document.body.append(h);

    // Which app is this page? The record that holds a demo for it, else the record whose address matches.
    let app = current ? { id: current.id } : null;
    let apps = [];
    try {
      apps = await rest('aoa_apps?select=id,name:data->>name,p:data->>previewUrl,w:data->>websiteUrl');
      if (!app) {
        const here = pageKey();
        // Same address, or a deeper page of an app that has its own path (a bare github.io host matches nothing by itself).
        const fits = (u) => { const n = u && norm(u); if (!n) return false; if (sameKey(n, here)) return true; try { return new URL(n).pathname.length > 1 && here.startsWith(n); } catch { return false; } };
        const hit = apps.filter((a) => [a.p, a.w].some(fits))
          .sort((a, b) => Math.max(norm(b.p || '').length, norm(b.w || '').length) - Math.max(norm(a.p || '').length, norm(a.w || '').length))[0];
        if (hit) app = { id: hit.id };
      }
    } catch (e) {
      body.replaceChildren(el('div', { className: 'empty' }, [el('b', { textContent: 'אין חיבור לתיק האפליקציות' }), `בדקי חיבור ונסי שוב. (${e.message})`]));
      return;
    }
    const info = app && apps.find((a) => a.id === app.id);
    render(body, app, info, apps, close);
  }

  async function render(body, app, info, apps, close) {
    body.replaceChildren();
    if (!app) {
      const sel = el('select', {}, [el('option', { value: '', textContent: 'בחירת האפליקציה מהתיק' }), ...apps.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he')).map((a) => el('option', { value: a.id, textContent: a.name || a.id }))]);
      sel.addEventListener('change', () => { if (sel.value) render(body, { id: sel.value }, apps.find((a) => a.id === sel.value), apps, close); });
      body.append(el('div', { className: 'empty' }, [el('b', { textContent: 'הדף הזה לא מזוהה בתיק' }), 'הכתובת לא תואמת לאף אפליקציה ב-aoa_apps. בחרי אותה, והכתובת תירשם לסרטון.']), sel);
      return;
    }
    let row;
    try { [row] = await rest(`aoa_apps?select=data&id=eq.${encodeURIComponent(app.id)}`); } catch {}
    const data = row ? row.data : null;
    const demo = { speed: 1, whole: true, at: [], ...(data && data.demo) };
    const name = (data && data.name) || (info && info.name) || app.id;
    body.append(el('div', { className: 'lab', textContent: `האפליקציה · ${name}` }));

    // Ready prompt: Claude produces the video (demo.cjs) and stores it here. Settings travel with it.
    const prompt = () => [
      `צור סרטון הדגמה לאפליקציה "${name}" (aoa_apps id: ${app.id}).`,
      `כתובת: ${(data && (data.previewUrl || data.websiteUrl)) || location.origin + location.pathname}`,
      `אורך יעד: ${Math.round(plan(demo).length || 40)} שניות, מהירות ${fmtX(demo.speed || 1)}.`,
      'לפי templates/demo.cjs ב-Claude-GH, במצב תסריט: כרטיס פתיחה, 4 עד 5 סצנות עם שורת תובנה ומשפט הסבר, כרטיס סיום עם הכתובת.',
      `העלה ל-aoa-media (${app.id}/demo-<ts>.mp4 ותמונת שער), ושמור ב-data.demo: src, poster, duration, וכתובת דף הבית ב-at.`,
    ].join('\n');

    if (!demo.src) {
      body.append(
        el('div', { className: 'empty' }, [el('b', { textContent: 'לאפליקציה הזו עוד אין סרטון' }), 'Claude מפיק אותו: מעתיקים את הבקשה ומדביקים בשיחת הפיתוח. אחרי ההפקה הכפתור מופיע כאן ובדף הבית.']),
        el('pre', { textContent: prompt() }),
        el('div', { className: 'acts' }, [copyBtn(prompt), el('span', { className: 'st' })]),
      );
      return;
    }

    const v = el('video', { src: demo.src, poster: demo.poster || '', muted: true, playsInline: true, preload: 'metadata', controls: false });
    const pv = el('div', { className: 'pv' }, v);
    const speedChips = el('div', { className: 'chips', role: 'group', 'aria-label': 'מהירות' });
    const len = el('input', { type: 'range', min: '8', step: '1', 'aria-label': 'אורך בשניות' });
    const lenNum = el('span', { className: 'num', dir: 'ltr' });
    const sum = el('div', { className: 'sum' });
    const whole = el('button', { className: 'tog', type: 'button' }, [el('span', { textContent: 'כל הסיפור' }), el('small', { textContent: 'אורך קצר יותר = מהיר יותר, והסוף תמיד נראה' })]);
    const onPage = el('button', { className: 'tog', type: 'button' }, [el('span', { textContent: 'כפתור בדף הזה' }), el('small', { textContent: location.pathname })]);
    const st = el('span', { className: 'st', role: 'status' });
    const save = el('button', { className: 'solid', type: 'button', textContent: 'שמירה' });
    const watch = el('button', { className: 'ghost', type: 'button', textContent: 'צפייה כמו מבקר', on: { click: () => play(demo) } });

    const refresh = () => {
      const dur = +demo.duration || 0;
      demo.speed = clamp(+demo.speed || 1, 0.5, 3);
      len.max = String(Math.max(8, Math.ceil(dur / 0.75)));
      if (demo.whole !== false) demo.length = dur / demo.speed;
      const pl = plan(demo);
      len.value = String(Math.round(pl.length));
      lenNum.textContent = fmt(pl.length);
      speedChips.replaceChildren(...SPEEDS.map((s) => el('button', {
        className: 'chip', type: 'button', dir: 'ltr', textContent: fmtX(s), 'aria-pressed': String(Math.abs(s - demo.speed) < 0.01),
        on: { click: () => { demo.speed = s; refresh(); } },
      })));
      whole.setAttribute('aria-pressed', String(demo.whole !== false));
      onPage.setAttribute('aria-pressed', String((demo.at || []).some((k) => sameKey(k, pageKey()))));
      sum.replaceChildren();
      const b = (t) => el('b', { dir: 'ltr', textContent: t });
      sum.append('הצופה רואה ', b(fmt(pl.length)), ' במהירות ', b(fmtX(pl.speed)), ': ', b(fmt(pl.end)), ' מתוך ', b(fmt(dur)), ' של המקור.');
      if (pl.end < dur - 0.5) sum.append(el('br'), 'הסוף נחתך, כולל כרטיס הסיום. "כל הסיפור" מחזיר אותו.');
      v.playbackRate = pl.speed;
    };
    len.addEventListener('input', () => {
      const L = +len.value;
      if (demo.whole !== false) demo.speed = Math.round(clamp((+demo.duration || L) / L, 0.5, 3) * 20) / 20;
      else demo.length = L;
      refresh();
    });
    whole.addEventListener('click', () => { demo.whole = demo.whole === false; refresh(); });
    onPage.addEventListener('click', () => {
      const k = pageKey();
      demo.at = (demo.at || []).some((x) => sameKey(x, k)) ? demo.at.filter((x) => !sameKey(x, k)) : [...(demo.at || []), k];
      refresh();
    });
    v.addEventListener('loadedmetadata', () => { if (!demo.duration) { demo.duration = Math.round(v.duration * 10) / 10; refresh(); } v.playbackRate = plan(demo).speed; });
    v.addEventListener('timeupdate', () => { if (v.currentTime >= plan(demo).end - 0.05) { v.currentTime = 0; } });
    v.addEventListener('mouseenter', () => v.play().catch(() => {}));
    v.addEventListener('mouseleave', () => v.pause());
    if (!reduce) v.autoplay = true;

    save.addEventListener('click', async () => {
      save.disabled = true; st.className = 'st'; st.textContent = 'שומר...';
      try {
        const [fresh] = await rest(`aoa_apps?select=data&id=eq.${encodeURIComponent(app.id)}`);
        const next = { ...(fresh ? fresh.data : data), demo: { ...demo, length: Math.round(plan(demo).length), updatedAt: new Date().toISOString() } };
        await edit('save_app', { id: app.id, data: next });
        current = { id: app.id, demo: next.demo };
        mount();
        st.textContent = `נשמר ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
      } catch (e) { st.className = 'st err'; st.textContent = `לא נשמר: ${e.message}`; }
      save.disabled = false;
    });

    body.append(
      pv,
      el('div', {}, [el('div', { className: 'lab', textContent: 'מהירות' }), speedChips]),
      el('div', {}, [el('div', { className: 'lab', textContent: 'אורך לצופה' }), el('div', { className: 'row' }, [len, lenNum])]),
      sum, whole, onPage,
      el('div', { className: 'acts' }, [save, watch, st]),
      el('div', {}, [el('div', { className: 'lab', textContent: 'סרטון חדש, באורך הזה' }), el('pre', { textContent: prompt() }), el('div', { className: 'acts', style: 'margin-top:8px' }, [copyBtn(prompt)])]),
    );
    refresh();
  }

  function copyBtn(text) {
    const b = el('button', { className: 'ghost', type: 'button', textContent: 'העתקת הבקשה ל-Claude' });
    b.addEventListener('click', async () => {
      const t = typeof text === 'function' ? text() : text;
      try { await navigator.clipboard.writeText(t); } catch { const ta = el('textarea', { value: t }); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      b.textContent = 'הועתק';
      setTimeout(() => (b.textContent = 'העתקת הבקשה ל-Claude'), 1400);
    });
    return b;
  }

  window.AIDemo = { open, play: (d) => play(d || (current && current.demo)), reload: load };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', load) : load();
})();
