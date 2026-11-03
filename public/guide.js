/*
 * guide.js - "מדריך חי": record a walkthrough once, share it as a link, and the next
 * button lights up on screen for whoever opens it.
 *
 * Loaded on demand by ai-menu.js (item "מדריך חי" inside the A&I button), so every app
 * that has the A&I button has it too. No server and no quota: a guide lives in the
 * link itself (#aig=...) and in this browser's localStorage.
 *
 *   AIGuide.open()            the panel: start recording, saved guides
 *   AIGuide.play(guide, i)    play a guide object from step i
 *
 * A step: { k: 'click' | 'type', t: instruction, sel, tag, txt, host?, url }
 * host is the CSS selector of a shadow host (for example <ai-menu>), so steps
 * inside the A&I menu can be shown as well.
 */
(function () {
  if (window.AIGuide) return;

  const STORE = 'ai-guides';
  const PLAY = 'ai-guide-play';
  const REC = 'ai-guide-rec';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const ss = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ---------- encoding: the guide is the link ----------
  const enc = (g) => btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  const here = () => location.pathname + location.search;
  const linkFor = (g) => {
    const start = (g.s[0] && g.s[0].url) || here();
    return location.origin + start + '#aig=' + enc(g);
  };

  // ---------- locating elements ----------
  const ACT = 'a,button,[role=button],[role=menuitem],[role=tab],[role=option],[role=checkbox],input,select,textarea,label,summary,[onclick],[tabindex]';
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const q = (v) => v.replace(/["\\]/g, '\\$&');
  const textOf = (el) => {
    const v =
      el.getAttribute('aria-label') ||
      norm(el.innerText).split(' ').slice(0, 7).join(' ') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.querySelector?.('img[alt]')?.getAttribute('alt') ||
      (el.tagName === 'INPUT' && el.type !== 'password' ? el.value : '') ||
      '';
    return norm(v).slice(0, 48);
  };
  const unique = (root, sel, el) => {
    try { const all = root.querySelectorAll(sel); return all.length === 1 && all[0] === el; } catch { return false; }
  };
  function selectorFor(el, root) {
    const tag = el.tagName.toLowerCase();
    if (el.id && !/\d{4,}|^[:_]|radix|react|^r\d/.test(el.id) && unique(root, '#' + CSS.escape(el.id), el)) return '#' + CSS.escape(el.id);
    for (const a of ['data-testid', 'data-test', 'name', 'aria-label', 'placeholder', 'title', 'href']) {
      const v = el.getAttribute(a);
      if (v && v.length < 120) {
        const s = `${tag}[${a}="${q(v)}"]`;
        if (unique(root, s, el)) return s;
      }
    }
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== root) {
      let p = n.tagName.toLowerCase();
      if (n.id && !/\d{4,}|^[:_]|radix|react/.test(n.id)) { parts.unshift('#' + CSS.escape(n.id)); break; }
      const par = n.parentElement;
      if (par) {
        const same = [...par.children].filter((c) => c.tagName === n.tagName);
        if (same.length > 1) p += `:nth-of-type(${same.indexOf(n) + 1})`;
      }
      parts.unshift(p);
      const s = parts.join(' > ');
      if (unique(root, s, el)) return s;
      n = par;
    }
    return parts.join(' > ');
  }
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  function rootFor(step) {
    if (!step.host) return document;
    const h = document.querySelector(step.host);
    return h && h.shadowRoot;
  }
  function find(step) {
    const root = rootFor(step);
    if (!root) return null;
    let el = null;
    try { el = root.querySelector(step.sel); } catch {}
    if (visible(el) && (!step.txt || textOf(el) === step.txt || !textOf(el))) return el;
    if (step.txt) {
      const cands = [...root.querySelectorAll(step.tag || ACT)].filter((c) => visible(c) && textOf(c) === step.txt);
      if (cands.length) return cands[0];
      const loose = [...root.querySelectorAll(ACT)].filter((c) => visible(c) && textOf(c).includes(step.txt));
      if (loose.length) return loose[0];
    }
    return visible(el) ? el : null;
  }

  // ---------- UI ----------
  const CSSTEXT = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: 'IBM Plex Sans Hebrew', system-ui, sans-serif; }
    .mono { font-family: 'IBM Plex Mono', 'IBM Plex Sans Hebrew', ui-monospace, monospace; letter-spacing: .14em; font-size: 10.5px; color: #6b7077; }
    button, input { font: inherit; color: inherit; border-radius: 0; }
    button { cursor: pointer; border: 1px solid #cfccc5; background: linear-gradient(180deg, #fbfaf8, #ecebe7); padding: 7px 12px; font-size: 13.5px;
      box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 2px rgba(20,22,26,.08); transition: transform .15s, box-shadow .15s; }
    button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 6px 14px -6px rgba(20,22,26,.4); }
    button:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 1px 2px rgba(20,22,26,.2) inset; }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible, input:focus-visible { outline: 2px solid #22324f; outline-offset: 2px; }
    button.solid { background: linear-gradient(180deg, #2a2d32, #17191c); color: #f4f3f0; border-color: #17191c; }
    button.x { border: 0; background: none; box-shadow: none; padding: 4px 8px; font-size: 18px; line-height: 1; color: #6b7077; }
    .dock { position: fixed; bottom: 16px; left: 16px; z-index: 2147483002; width: 360px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto;
      direction: rtl; text-align: right; background: #f7f6f3; color: #17191c; border: 1px solid #cfccc5; padding: 14px 16px;
      box-shadow: 0 4px 6px rgba(20,22,26,.06), 0 18px 36px rgba(20,22,26,.14), 0 48px 96px -24px rgba(20,22,26,.35); }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
    h2 { margin: 0; font-size: 17px; font-weight: 600; }
    .insight { margin: 10px 0 2px; font-size: 15px; font-weight: 600; }
    .insight mark { background: linear-gradient(180deg, transparent 55%, #f6d35b 55%); color: inherit; padding: 0 2px; }
    .detail { margin: 0 0 12px; font-size: 13px; color: #3c4046; line-height: 1.5; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .list { margin: 12px 0 0; padding: 0; list-style: none; border-top: 1px solid #e2dfd9; }
    .list li { padding: 10px 0; border-bottom: 1px solid #e2dfd9; display: grid; gap: 6px; }
    .list b { font-size: 14px; font-weight: 600; }
    .steps { counter-reset: s; margin: 10px 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .steps li { display: grid; grid-template-columns: 28px 1fr auto; gap: 6px; align-items: center; }
    .steps li::before { counter-increment: s; content: counter(s, decimal-leading-zero); font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #22324f; }
    input[type=text] { width: 100%; border: 1px solid #cfccc5; background: #fff; padding: 7px 9px; font-size: 13.5px; }
    .title { font-weight: 600; margin-bottom: 4px; }
    .rec { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: #a3261b; }
    .dot { width: 10px; height: 10px; background: #c0392b; border-radius: 50%; animation: pulse 1.2s infinite; }
    .last { font-size: 13px; color: #3c4046; margin: 8px 0 10px; min-height: 1.4em; }
    .note { font-size: 12.5px; color: #2f5d46; min-height: 1.2em; margin-top: 8px; }
    .ring { position: fixed; z-index: 2147483001; pointer-events: none; border: 3px solid #f2b705; border-radius: 0;
      box-shadow: 0 0 0 4px rgba(242,183,5,.35), 0 0 0 100vmax rgba(15,18,24,.38); transition: all .25s cubic-bezier(.2,.7,.2,1); }
    .ring::after { content: ''; position: absolute; inset: -9px; border: 2px solid rgba(242,183,5,.7); animation: halo 1.4s infinite; }
    .bubble { position: fixed; z-index: 2147483002; width: 320px; max-width: calc(100vw - 24px); direction: rtl; text-align: right;
      background: #17191c; color: #f4f3f0; padding: 12px 14px; border-top: 3px solid #f2b705;
      box-shadow: 0 18px 40px -10px rgba(0,0,0,.55); transition: top .25s, left .25s; }
    .bubble .mono { color: #b9bcc0; }
    .bubble .say { margin: 6px 0 10px; font-size: 15px; font-weight: 600; line-height: 1.4; }
    .bubble .wait { font-size: 12.5px; color: #f6d35b; margin: -4px 0 10px; }
    .bubble button { background: #2a2d32; color: #f4f3f0; border-color: #3c4046; box-shadow: none; padding: 5px 10px; font-size: 13px; }
    .bubble button.solid { background: #f2b705; color: #17191c; border-color: #f2b705; }
    .bubble button.x { background: none; color: #b9bcc0; }
    .bar { height: 3px; background: #3c4046; margin-top: 10px; }
    .bar i { display: block; height: 100%; background: #f2b705; transition: width .25s; }
    @keyframes pulse { 50% { opacity: .35; } }
    @keyframes halo { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.06); } }
    @media (prefers-reduced-motion: reduce) { .ring, .bubble, button { transition: none; } .ring::after, .dot { animation: none; } }
  `;

  let host, root;
  function mount() {
    if (host && host.isConnected) return;
    host = document.createElement('ai-guide-layer');
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSSTEXT}</style>`;
    document.documentElement.append(host);
  }
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    n.append(...kids.filter((k) => k != null));
    return n;
  };
  function layer(name, node) {
    mount();
    root.querySelector(`[data-layer="${name}"]`)?.remove();
    if (node) { node.dataset.layer = name; root.append(node); }
    return node;
  }
  const isOurs = (e) => e.composedPath().some((n) => n === host);

  // ---------- saved guides ----------
  const saved = () => ls.get(STORE, []).filter((g) => g && g.s && g.s.length);
  const save = (g) => {
    const all = saved().filter((x) => x.id !== g.id);
    all.unshift(g);
    ls.set(STORE, all.slice(0, 40));
  };
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.append(ta); ta.select();
      const okc = document.execCommand('copy'); ta.remove(); return okc;
    }
  }

  // ---------- home panel ----------
  function open(msg) {
    stopPlay(false);
    const list = saved();
    const note = el('div', { class: 'note', role: 'status' }, msg || '');
    const ul = el('ul', { class: 'list', 'aria-label': 'המדריכים השמורים' });
    for (const g of list) {
      ul.append(el('li', {},
        el('b', {}, g.title),
        el('span', { class: 'mono' }, `${g.s.length} צעדים · ${new Date(g.at || Date.now()).toLocaleDateString('he-IL')}`),
        el('div', { class: 'row' },
          el('button', { class: 'solid', type: 'button', onclick: () => play(g, 0) }, 'הפעלה'),
          el('button', { type: 'button', onclick: async () => { note.textContent = (await copy(linkFor(g))) ? 'הקישור הועתק. מי שפותח אותו רואה את הכפתור הבא מואר.' : 'ההעתקה נכשלה. נסי שוב.'; } }, 'העתקת קישור'),
          el('button', { type: 'button', onclick: () => edit(g) }, 'עריכה'),
          el('button', { type: 'button', onclick: () => download(g) }, 'דף מודפס'),
          el('button', { type: 'button', 'aria-label': `מחיקת ${g.title}`, onclick: () => { ls.set(STORE, saved().filter((x) => x.id !== g.id)); open('המדריך נמחק מהמכשיר הזה. קישורים ששותפו ממשיכים לעבוד.'); } }, 'מחיקה'),
        ),
      ));
    }
    if (!list.length) ul.append(el('li', {}, el('span', { class: 'detail' }, 'עוד אין מדריכים במכשיר הזה. ההקלטה הראשונה לוקחת דקה.')));
    layer('dock', el('section', { class: 'dock', role: 'dialog', 'aria-label': 'מדריך חי' },
      el('div', { class: 'top' },
        el('div', {}, el('div', { class: 'mono' }, 'LIVE GUIDE · מדריך חי'), el('h2', {}, 'מדריך חי לאפליקציה')),
        el('button', { class: 'x', type: 'button', 'aria-label': 'סגירה', onclick: close }, '×'),
      ),
      el('p', { class: 'insight', html: 'מקליטים <mark>פעם אחת</mark>, מסבירים לכולם.' }),
      el('p', { class: 'detail', html: 'כל לחיצה הופכת ל<b>צעד</b>. מי שפותח את הקישור רואה את <b>הכפתור הבא מואר</b> על המסך.' }),
      el('div', { class: 'row' }, el('button', { class: 'solid', type: 'button', onclick: startRec }, 'התחלת הקלטה')),
      ul, note,
    ));
    root.querySelector('.dock .solid')?.focus();
  }
  function close() { layer('dock', null); }

  // ---------- recording ----------
  let rec = null;
  function startRec() {
    rec = { id: 'g' + Date.now().toString(36), title: norm(document.title) || 'מדריך', s: [], at: Date.now() };
    ss.set(REC, rec);
    armRec();
  }
  function armRec() {
    document.addEventListener('click', onRecClick, true);
    document.addEventListener('change', onRecChange, true);
    recBar();
  }
  function disarmRec() {
    document.removeEventListener('click', onRecClick, true);
    document.removeEventListener('change', onRecChange, true);
  }
  function locate(e) {
    const path = e.composedPath().filter((n) => n.nodeType === 1);
    const raw = path[0];
    if (!raw) return null;
    const shadow = raw.getRootNode();
    const r = shadow instanceof ShadowRoot ? shadow : document;
    let t = raw.closest ? raw.closest(ACT) || raw : raw;
    if (r !== document && !r.contains(t)) t = raw;
    const step = { sel: selectorFor(t, r), tag: t.tagName.toLowerCase(), txt: textOf(t), url: here() };
    if (r !== document) step.host = selectorFor(r.host, document);
    return { t, step };
  }
  function onRecClick(e) {
    if (isOurs(e)) return;
    const hit = locate(e);
    if (!hit) return;
    const { t, step } = hit;
    if (step.txt === 'מדריך חי') return;
    if (/^(input|textarea|select)$/.test(step.tag) && !/^(checkbox|radio|button|submit)$/.test(t.type)) return; // the change event records it
    step.k = 'click';
    step.t = step.txt ? `ללחוץ על «${step.txt}»` : 'ללחוץ על הרכיב המסומן';
    push(step);
  }
  function onRecChange(e) {
    if (isOurs(e)) return;
    const hit = locate(e);
    if (!hit || !/^(input|textarea|select)$/.test(hit.step.tag)) return;
    const { t, step } = hit;
    if (/^(checkbox|radio)$/.test(t.type)) return;
    const name = t.getAttribute('aria-label') || t.getAttribute('placeholder') || t.labels?.[0]?.innerText || t.name || 'השדה';
    step.txt = textOf(t) === t.value ? '' : step.txt;
    step.k = 'type';
    if (step.tag === 'select') step.t = `לבחור «${norm(t.selectedOptions?.[0]?.text)}» ב«${norm(name)}»`;
    else step.t = t.type === 'password' ? `להקליד סיסמה ב«${norm(name)}»` : `להקליד ב«${norm(name)}», למשל «${norm(t.value).slice(0, 30)}»`;
    push(step);
  }
  function push(step) {
    const last = rec.s[rec.s.length - 1];
    if (last && last.sel === step.sel && last.host === step.host && last.k === step.k && last.t === step.t) return;
    rec.s.push(step);
    ss.set(REC, rec);
    recBar();
  }
  function recBar() {
    const last = rec.s[rec.s.length - 1];
    layer('dock', el('section', { class: 'dock', role: 'region', 'aria-label': 'הקלטת מדריך' },
      el('div', { class: 'top' },
        el('span', { class: 'rec' }, el('span', { class: 'dot', 'aria-hidden': 'true' }), 'מקליט'),
        el('span', { class: 'mono', 'aria-live': 'polite' }, `${rec.s.length} צעדים`),
      ),
      el('p', { class: 'last' }, last ? `${String(rec.s.length).padStart(2, '0')}  ${last.t}` : 'עובדים כרגיל. כל לחיצה נרשמת כצעד.'),
      el('div', { class: 'row' },
        el('button', { class: 'solid', type: 'button', disabled: rec.s.length ? null : '', onclick: finishRec }, 'סיום ועריכה'),
        el('button', { type: 'button', disabled: rec.s.length ? null : '', onclick: () => { rec.s.pop(); ss.set(REC, rec); recBar(); } }, 'ביטול הצעד האחרון'),
        el('button', { type: 'button', onclick: () => { disarmRec(); rec = null; ss.set(REC, null); open('ההקלטה בוטלה.'); } }, 'ביטול'),
      ),
    ));
  }
  function finishRec() {
    disarmRec();
    const g = rec;
    rec = null;
    ss.set(REC, null);
    edit(g);
  }

  // ---------- editing a guide ----------
  function edit(g) {
    g = JSON.parse(JSON.stringify(g));
    const title = el('input', { type: 'text', value: g.title, autocomplete: 'off', 'aria-label': 'שם המדריך' });
    const steps = el('ol', { class: 'steps' });
    const note = el('div', { class: 'note', role: 'status' });
    const draw = () => {
      steps.replaceChildren(...g.s.map((s, i) => {
        const inp = el('input', { type: 'text', value: s.t, autocomplete: 'off', 'aria-label': `צעד ${i + 1}` });
        inp.addEventListener('input', () => (s.t = inp.value));
        return el('li', {}, inp, el('button', { class: 'x', type: 'button', 'aria-label': `מחיקת צעד ${i + 1}`, onclick: () => { g.s.splice(i, 1); draw(); } }, '×'));
      }));
    };
    draw();
    const commit = () => { g.title = norm(title.value) || 'מדריך'; g.at = Date.now(); save(g); return g; };
    layer('dock', el('section', { class: 'dock', role: 'dialog', 'aria-label': 'עריכת מדריך' },
      el('div', { class: 'top' },
        el('div', { class: 'mono' }, 'עריכת המדריך'),
        el('button', { class: 'x', type: 'button', 'aria-label': 'חזרה לרשימה', onclick: () => open() }, '×'),
      ),
      el('div', { class: 'title' }, title),
      el('p', { class: 'detail' }, 'אפשר לנסח כל צעד מחדש. הניסוח מופיע בבועה ליד הכפתור.'),
      steps,
      el('div', { class: 'row' },
        el('button', { class: 'solid', type: 'button', onclick: async () => { const s = commit(); note.textContent = (await copy(linkFor(s))) ? 'נשמר והקישור הועתק. אפשר להדביק בווטסאפ או במייל.' : 'נשמר. ההעתקה נכשלה.'; } }, 'שמירה והעתקת קישור'),
        el('button', { type: 'button', onclick: () => play(commit(), 0) }, 'הפעלה לבדיקה'),
        el('button', { type: 'button', onclick: () => download(commit()) }, 'דף מודפס'),
      ),
      note,
    ));
  }

  // ---------- a printable page (for mail, print or a binder) ----------
  function download(g) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(g.title)}</title>
<style>body{font-family:'IBM Plex Sans Hebrew',system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#17191c;background:#fff;direction:rtl}
.m{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;color:#6b7077}h1{font-size:26px;margin:6px 0 4px}
.i{font-size:17px;font-weight:600}mark{background:linear-gradient(180deg,transparent 55%,#f6d35b 55%)}ol{list-style:none;padding:0;counter-reset:s}
li{counter-increment:s;display:grid;grid-template-columns:44px 1fr;gap:10px;padding:14px 0;border-bottom:1px solid #e2dfd9;font-size:16px;font-weight:600}
li::before{content:counter(s,decimal-leading-zero);font-family:'IBM Plex Mono',monospace;color:#22324f}a{color:#22324f}</style>
<div class="m">LIVE GUIDE · מדריך חי · ${g.s.length} צעדים</div><h1>${esc(g.title)}</h1>
<p class="i">את ה<mark>מסלול המלא</mark> רואים במדריך החי: הכפתור הבא מואר על המסך.</p>
<p><a href="${esc(linkFor(g))}">פתיחת המדריך החי באפליקציה</a></p>
<ol>${g.s.map((s) => `<li>${esc(s.t)}</li>`).join('')}</ol></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `${g.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || 'guide'}.html`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- playback ----------
  let pl = null;
  function play(g, i = 0) {
    stopPlay(false);
    close();
    pl = { g, i, target: null, timer: 0 };
    ss.set(PLAY, { g, i });
    document.addEventListener('click', onPlayClick, true);
    document.addEventListener('change', onPlayChange, true);
    document.addEventListener('keydown', onPlayKey);
    pl.timer = setInterval(tick, 250);
    show(true);
  }
  function stopPlay(done) {
    if (!pl) return;
    clearInterval(pl.timer);
    document.removeEventListener('click', onPlayClick, true);
    document.removeEventListener('change', onPlayChange, true);
    document.removeEventListener('keydown', onPlayKey);
    const g = pl.g;
    pl = null;
    ss.set(PLAY, null);
    layer('ring', null);
    layer('bubble', null);
    if (done) {
      const b = layer('bubble', el('div', { class: 'bubble', role: 'status', style: 'bottom:16px;left:16px' },
        el('div', { class: 'mono' }, `${g.s.length} מתוך ${g.s.length}`),
        el('p', { class: 'say' }, 'המדריך הושלם.'),
        el('div', { class: 'row' }, el('button', { type: 'button', onclick: () => play(g, 0) }, 'שוב מההתחלה'), el('button', { class: 'x', type: 'button', 'aria-label': 'סגירה', onclick: () => layer('bubble', null) }, '×')),
      ));
      setTimeout(() => b.isConnected && layer('bubble', null), 6000);
    }
  }
  function go(n) {
    if (!pl) return;
    if (n >= pl.g.s.length) return stopPlay(true);
    pl.i = Math.max(0, n);
    pl.target = null;
    ss.set(PLAY, { g: pl.g, i: pl.i });
    show(true);
  }
  function onPlayKey(e) { if (e.key === 'Escape') stopPlay(false); }
  function onPlayClick(e) {
    if (!pl || isOurs(e)) return;
    const s = pl.g.s[pl.i];
    if (s.k !== 'click' || !pl.target) return;
    if (e.composedPath().includes(pl.target)) {
      const n = pl.i + 1;
      ss.set(PLAY, n < pl.g.s.length ? { g: pl.g, i: n } : null); // a link may leave the page first
      setTimeout(() => pl && pl.i === n - 1 && go(n), 350);
    }
  }
  function onPlayChange(e) {
    if (!pl || isOurs(e)) return;
    const s = pl.g.s[pl.i];
    if (s.k === 'type' && pl.target && e.composedPath().includes(pl.target)) go(pl.i + 1);
  }
  function tick() {
    if (!pl) return;
    const t = find(pl.g.s[pl.i]);
    if (t !== pl.target) { pl.target = t; show(!!t); } else if (t) place();
  }
  function show(scroll) {
    if (!pl) return;
    const s = pl.g.s[pl.i];
    const t = pl.target || find(s);
    pl.target = t;
    const n = pl.g.s.length;
    const other = s.url && s.url !== here();
    const wait = t ? null : el('p', { class: 'wait' }, other ? 'הצעד הזה נמצא בדף אחר.' : 'מחכים שהרכיב יופיע במסך. אם צריך, לגלול או לפתוח את החלון הקודם.');
    layer('bubble', el('div', { class: 'bubble', role: 'dialog', 'aria-live': 'polite', 'aria-label': `צעד ${pl.i + 1} מתוך ${n}` },
      el('div', { class: 'top' },
        el('span', { class: 'mono' }, `צעד ${String(pl.i + 1).padStart(2, '0')} מתוך ${String(n).padStart(2, '0')} · ${pl.g.title}`),
        el('button', { class: 'x', type: 'button', 'aria-label': 'סגירת המדריך', onclick: () => stopPlay(false) }, '×'),
      ),
      el('p', { class: 'say' }, s.t),
      wait,
      el('div', { class: 'row' },
        other && !t ? el('button', { class: 'solid', type: 'button', onclick: () => { ss.set(PLAY, { g: pl.g, i: pl.i }); location.href = s.url; } }, 'מעבר לדף') : null,
        el('button', { type: 'button', disabled: pl.i ? null : '', onclick: () => go(pl.i - 1) }, 'הקודם'),
        el('button', { class: t ? '' : 'solid', type: 'button', onclick: () => go(pl.i + 1) }, pl.i + 1 < n ? (t ? 'הבא' : 'דילוג') : 'סיום'),
      ),
      el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: `width:${((pl.i + 1) / n) * 100}%` })),
    ));
    if (t) {
      if (!root.querySelector('[data-layer=ring]')) layer('ring', el('div', { class: 'ring', 'aria-hidden': 'true' }));
      if (scroll) {
        const r = t.getBoundingClientRect();
        if (r.top < 70 || r.bottom > innerHeight - 160) t.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
    } else layer('ring', null);
    place();
  }
  function place() {
    if (!pl) return;
    const b = root.querySelector('[data-layer=bubble]');
    const ring = root.querySelector('[data-layer=ring]');
    const t = pl.target;
    if (!b) return;
    if (!t || !ring) { Object.assign(b.style, { top: '', left: '16px', bottom: '16px' }); return; }
    const r = t.getBoundingClientRect();
    const pad = 6;
    Object.assign(ring.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const bw = b.offsetWidth, bh = b.offsetHeight, vw = document.documentElement.clientWidth;
    let top = r.bottom + 16;
    if (top + bh > innerHeight - 8) top = r.top - bh - 16;
    if (top < 8) top = Math.min(innerHeight - bh - 8, r.bottom + 16);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - bw / 2, vw - bw - 12));
    Object.assign(b.style, { top: `${Math.max(8, top)}px`, left: `${left}px`, bottom: '' });
  }
  addEventListener('resize', () => place());
  addEventListener('scroll', () => place(), true);

  // ---------- start: a link, or a guide that continues after a page change ----------
  function boot() {
    const m = /[#&]aig=([^&]+)/.exec(location.hash);
    if (m) {
      try {
        const g = dec(m[1]);
        history.replaceState(history.state, '', location.pathname + location.search);
        if (g && g.s && g.s.length) { save(g); return play(g, 0); }
      } catch {}
    }
    const p = ss.get(PLAY);
    if (p && p.g) return play(p.g, p.i || 0);
    const r = ss.get(REC);
    if (r && r.s) { rec = r; armRec(); }
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();

  window.AIGuide = { open, play, record: startRec, link: linkFor, encode: enc, decode: dec };
  dispatchEvent(new CustomEvent('ai-guide-ready'));
})();
