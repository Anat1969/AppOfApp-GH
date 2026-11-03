/*
 * <space-walk>: line, volume, first person. A plan becomes a 3D scene you walk through
 * at a chosen eye height, with a live count of what blocks the view from that height.
 *
 * Shared by all of Anat's apps (2026-11-03), served like ai-menu.js:
 *   <script src="https://appofapp-gh.vercel.app/walk.js"></script>
 *   <space-walk ref-base="/principles/"></space-walk>
 *   el.plan = { ...see docs/walk-standard.md... }      // or <space-walk src="plan.json">
 *
 * Attributes: src, eye (cm), variant (id), view ("walk" | "top"), ref-base, three (module URL).
 * Event: "walkchange" with detail { eye, variant, view } on every user change.
 * Theme: --sw-ink, --sw-paper, --sw-card, --sw-line, --sw-muted, --sw-accent,
 *        --sw-problem, --sw-solution, --sw-marker, --sw-font, --sw-mono, --sw-display.
 *
 * The rule is shown on screen: an opaque element whose top reaches the eye height blocks
 * the view. See-through fences and glass never block; a window is measured by its sill.
 */
(function () {
  if (customElements.get('space-walk')) return;

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  const SEE_THROUGH = ['fence', 'glass', 'tree', 'surface', 'note', 'shade', 'pole', 'play'];
  const SOLID = ['wall', 'hedge', 'planter', 'car', 'fence', 'window', 'box', 'bench', 'glass'];
  const DEFAULT_HEIGHTS = [
    { cm: 95, label: 'ילד בן 3' },
    { cm: 120, label: 'מבוגר יושב' },
    { cm: 160, label: 'מבוגר עומד' },
  ];

  /* ---------- pure rules (also exposed as SpaceWalk.evaluate for tests) ---------- */
  function itemsOf(plan, variantId) {
    const v = (plan.variants || []).find((x) => x.id === variantId);
    return [...(plan.items || []), ...(v ? v.items || [] : [])];
  }
  function opaque(it) {
    if (it.opaque != null) return !!it.opaque;
    if (it.type === 'prism' && (it.glass || (it.h || 0) <= 0.05)) return false;
    return !SEE_THROUGH.includes(it.type);
  }
  // even-odd point in polygon, points as [[x, z], ...]
  function inPoly(x, z, pts) {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins;
    }
    return ins;
  }
  function blockTop(it) {
    if (it.blockTop != null) return it.blockTop;
    if (it.type === 'window') return it.sill || 0;
    return (it.y0 || 0) + (it.h || 0);
  }
  function sightState(it, eyeM) {
    if (!opaque(it)) return 'through';
    return blockTop(it) >= eyeM - 1e-6 ? 'block' : 'clear';
  }
  function counted(it) {
    return it.label && it.count !== false && it.type !== 'note' && !it.check;
  }
  function evaluate(plan, variantId, eyeCm) {
    const eye = eyeCm / 100;
    const rows = itemsOf(plan, variantId).filter(counted).map((it) => ({ it, state: sightState(it, eye) }));
    return { rows, blocks: rows.filter((r) => r.state === 'block').length, total: rows.length };
  }
  const cm = (m) => Math.round(m * 100);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // **bold** in plan texts, the shared text standard
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  const CSS = `
    :host { display: block; position: relative; height: var(--sw-height, 100%); min-height: 420px;
      --k-ink: var(--sw-ink, #1a1a18); --k-paper: var(--sw-paper, #f0ede6); --k-card: var(--sw-card, #fafaf8);
      --k-line: var(--sw-line, #d4d0c7); --k-muted: var(--sw-muted, #6f6253); --k-accent: var(--sw-accent, #2d4a3e);
      --k-problem: var(--sw-problem, #b8472e); --k-solution: var(--sw-solution, #2d6a4e); --k-marker: var(--sw-marker, #f3e37c);
      font-family: var(--sw-font, inherit); color: var(--k-ink); direction: rtl; outline: none; }
    *, *::before, *::after { box-sizing: border-box; }
    .sw { display: grid; grid-template-columns: minmax(0, 1fr) 340px; height: 100%; background: var(--k-paper); }
    .stage { position: relative; min-height: 0; overflow: hidden; background: #dfe5e8; border-inline-start: 1px solid var(--k-line); container-type: inline-size; }
    @container (max-width: 640px) { .hint { display: none; } }
    .gl { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
    .gl:active { cursor: grabbing; }
    .msg { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center;
      font-size: 15px; color: var(--k-muted); pointer-events: none; }
    .msg[hidden] { display: none; }
    .eye { position: absolute; top: 12px; right: 12px; background: var(--k-ink); color: var(--k-card);
      font-family: var(--sw-font, inherit); font-variant-numeric: tabular-nums; font-size: 12px; padding: 6px 10px; }
    .eye b { color: var(--k-marker); font-weight: 700; }
    .mapbox { position: absolute; left: 12px; bottom: 12px; background: var(--k-card); border: 1px solid var(--k-line); padding: 8px; }
    .map { display: block; width: 200px; height: 170px; cursor: crosshair; }
    .legend { display: flex; gap: 10px; margin-top: 6px; font-size: 11px; color: var(--k-muted); }
    .legend i { display: inline-block; width: 10px; height: 10px; margin-inline-end: 4px; vertical-align: -1px; }
    .pad { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 6px; }
    .hint { position: absolute; top: 12px; left: 12px; max-width: 280px; font-size: 12px; line-height: 1.5;
      background: rgba(250, 250, 248, .92); border: 1px solid var(--k-line); padding: 6px 10px; color: var(--k-ink); }
    button { font: inherit; color: inherit; cursor: pointer; border-radius: 0; }
    .btn { background: var(--k-card); border: 1px solid var(--k-ink); border-bottom-width: 3px; padding: 8px 14px;
      font-size: 14px; font-weight: 700; transition: transform .12s, background .12s; }
    .btn:hover { background: #fff; transform: translateY(-1px); }
    .btn:active { transform: translateY(1px); border-bottom-width: 1px; margin-top: 2px; }
    .btn:focus-visible, .opt:focus-visible, .row:focus-visible { outline: 2px solid var(--k-accent); outline-offset: 2px; }
    .panel { overflow-y: auto; padding: 20px 20px 28px; background: var(--k-card); }
    .lbl { font-family: var(--sw-font, inherit); font-variant-numeric: tabular-nums; font-size: 11px; color: var(--k-muted);
      margin: 20px 0 8px; }
    .lbl:first-child { margin-top: 0; }
    .title { font-size: 13px; color: var(--k-muted); margin: 0 0 6px; }
    .insight { font-family: var(--sw-display, inherit); font-size: 26px; line-height: 1.2; margin: 0 0 8px; font-weight: 400; }
    .insight b { background: linear-gradient(transparent 55%, var(--k-marker) 55%); font-weight: 700; }
    .explain { font-size: 14px; line-height: 1.6; margin: 0; }
    .explain b { font-weight: 700; }
    .heights { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .opt { background: var(--k-paper); border: 1px solid var(--k-line); border-bottom-width: 3px; padding: 8px 6px; text-align: center;
      transition: transform .12s, background .12s; }
    .opt:hover { transform: translateY(-1px); background: #fff; }
    .opt[aria-pressed='true'] { background: var(--k-ink); color: var(--k-card); border-color: var(--k-ink); }
    .opt .n { display: block; font-family: var(--sw-font, inherit); font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 700; line-height: 1.1; }
    .opt .u { font-size: 11px; }
    .opt .who { display: block; font-size: 12px; margin-top: 2px; }
    .opt .cnt { display: block; margin-top: 6px; font-size: 12px; font-weight: 700; color: var(--k-problem); }
    .opt .cnt.zero { color: var(--k-solution); }
    .opt[aria-pressed='true'] .cnt { color: var(--k-marker); }
    .opt[aria-pressed='true'] .cnt.zero { color: #9fd6b4; }
    .vars, .views { display: flex; gap: 6px; flex-wrap: wrap; }
    .vars .opt, .views .opt { flex: 1 1 0; font-size: 14px; font-weight: 700; padding: 9px 8px; }
    .vars .opt[data-tone='problem'] { border-bottom-color: var(--k-problem); }
    .vars .opt[data-tone='solution'] { border-bottom-color: var(--k-solution); }
    .vars .opt[aria-pressed='true'][data-tone='problem'] { background: var(--k-problem); border-color: var(--k-problem); }
    .vars .opt[aria-pressed='true'][data-tone='solution'] { background: var(--k-solution); border-color: var(--k-solution); }
    .vnote { font-size: 13px; line-height: 1.5; margin: 8px 0 0; }
    ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .row { display: grid; grid-template-columns: 6px 1fr auto; gap: 10px; align-items: center; width: 100%; text-align: start;
      background: var(--k-paper); border: 1px solid transparent; padding: 8px 10px 8px 8px; transition: background .12s, border-color .12s; }
    .row:hover { background: #fff; border-color: var(--k-line); }
    .row .bar { align-self: stretch; }
    .row[data-s='block'] .bar { background: var(--k-problem); }
    .row[data-s='clear'] .bar, .row[data-s='through'] .bar, .row[data-s='ok'] .bar { background: var(--k-solution); }
    .row[data-s='fail'] .bar { background: var(--k-problem); }
    .row .name { font-weight: 700; font-size: 14px; }
    .row .ref { display: block; font-size: 12px; color: var(--k-muted); margin-top: 2px; }
    .row .ref a { color: inherit; }
    .row .ref a:hover { color: var(--k-accent); }
    .row .val { text-align: end; font-family: var(--sw-font, inherit); font-variant-numeric: tabular-nums; font-size: 15px; font-weight: 700; white-space: nowrap; }
    .row .st { display: block; font-family: var(--sw-font, inherit); font-size: 12px; font-weight: 700; }
    .row[data-s='block'] .st, .row[data-s='fail'] .st { color: var(--k-problem); }
    .row[data-s='clear'] .st, .row[data-s='through'] .st, .row[data-s='ok'] .st { color: var(--k-solution); }
    .rule { font-size: 12px; line-height: 1.6; margin: 20px 0 0; padding-top: 12px; border-top: 1px solid var(--k-line); }
    .src { font-size: 11px; line-height: 1.5; color: var(--k-muted); margin: 8px 0 0; }
    .src a { color: inherit; }
    @media (max-width: 860px) {
      :host { height: auto; }
      .sw { grid-template-columns: 1fr; grid-template-rows: 62vh auto; height: auto; }
      .stage { border-inline-start: 0; border-bottom: 1px solid var(--k-line); }
      .map { width: 132px; height: 112px; }
      .hint { display: none; }
      .panel { overflow: visible; }
    }
    @media (prefers-reduced-motion: reduce) { .btn, .opt, .row { transition: none; } }
  `;

  class SpaceWalk extends HTMLElement {
    static get observedAttributes() { return ['src']; }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._plan = null;
      this._eyeCm = 95;
      this._eye = 0.95;
      this._view = 'walk';
      this._variant = null;
      this._pos = { x: 0, z: 0 };
      this._yaw = 0;
      this._pitch = 0;
      this._az = 0.6;
      this._keys = new Set();
      this._move = 0;
      this._turnTo = null;
      this._flash = null;
      this._raf = 0;
      this._reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    set plan(p) { this._plan = p; this._applyPlan(); }
    get plan() { return this._plan; }

    connectedCallback() {
      // a property set before the element upgraded would shadow the setter
      if (Object.prototype.hasOwnProperty.call(this, 'plan')) {
        const p = this.plan; delete this.plan; this.plan = p;
      }
      if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
      if (!this.shadowRoot.firstChild) this._skeleton();
      if (this.getAttribute('src') && !this._plan) this._load(this.getAttribute('src'));
      else if (this._plan) this._applyPlan();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._ro) this._ro.disconnect();
      if (this._renderer) { this._renderer.dispose(); this._renderer = null; this._booted = false; }
    }

    attributeChangedCallback(name, old, val) {
      if (name === 'src' && val && old !== val && this.isConnected) this._load(val);
    }

    async _load(src) {
      try {
        const r = await fetch(src);
        if (!r.ok) throw new Error(r.status);
        this.plan = await r.json();
      } catch (e) {
        this._msg('התוכנית לא נטענה. בדקו את הכתובת ב-src ורעננו.');
      }
    }

    $(s) { return this.shadowRoot.querySelector(s); }

    _skeleton() {
      this.shadowRoot.innerHTML = `<style>${CSS}</style>
        <div class="sw" dir="rtl">
          <div class="stage" aria-label="הליכה בתלת־ממד">
            <canvas class="gl"></canvas>
            <div class="msg">טוען תלת־ממד...</div>
            <div class="eye" aria-live="polite"></div>
            <div class="hint">גררו כדי להסתכל. חיצים או W A S D כדי ללכת. לחיצה על המפה מעבירה לשם.</div>
            <div class="mapbox">
              <canvas class="map" width="400" height="340" aria-label="תוכנית: לחיצה מעבירה למקום"></canvas>
              <div class="legend"><span><i style="background:var(--k-problem)"></i>חוסם</span><span><i style="background:var(--k-solution)"></i>פתוח</span><span><i style="background:var(--k-ink)"></i>אתם</span></div>
            </div>
            <div class="pad"><button class="btn" data-move="1">קדימה</button><button class="btn" data-move="-1">אחורה</button></div>
          </div>
          <aside class="panel">
            <p class="title"></p>
            <h2 class="insight"></h2>
            <p class="explain"></p>
            <div class="lbl">גובה העיניים</div>
            <div class="heights"></div>
            <div class="lbl">מצב התכנון</div>
            <div class="vars"></div>
            <p class="vnote"></p>
            <div class="lbl">תצוגה</div>
            <div class="views">
              <button class="opt" data-view="walk" aria-pressed="true">גוף ראשון</button>
              <button class="opt" data-view="top" aria-pressed="false">מבט על</button>
            </div>
            <div class="lbl sight-lbl">מה רואים מהגובה הזה</div>
            <ol class="sight"></ol>
            <div class="lbl checks-lbl">מידות במקום</div>
            <ol class="checks"></ol>
            <p class="rule"></p>
            <p class="src"></p>
          </aside>
        </div>`;

      const sr = this.shadowRoot;
      sr.querySelector('.heights').addEventListener('click', (e) => {
        const b = e.target.closest('[data-eye]'); if (b) this._setEye(+b.dataset.eye, true);
      });
      sr.querySelector('.vars').addEventListener('click', (e) => {
        const b = e.target.closest('[data-variant]'); if (b) this._setVariant(b.dataset.variant, true);
      });
      sr.querySelector('.views').addEventListener('click', (e) => {
        const b = e.target.closest('[data-view]'); if (b) this._setView(b.dataset.view, true);
      });
      const pick = (e) => {
        if (e.target.closest('a')) return;
        const b = e.target.closest('[data-id]'); if (b) this._lookAt(b.dataset.id);
      };
      sr.querySelector('.sight').addEventListener('click', pick);
      sr.querySelector('.checks').addEventListener('click', pick);
      sr.querySelectorAll('[data-move]').forEach((b) => {
        const go = (e) => { e.preventDefault(); this._move = +b.dataset.move; };
        const stop = () => { this._move = 0; };
        b.addEventListener('pointerdown', go);
        b.addEventListener('pointerup', stop);
        b.addEventListener('pointerleave', stop);
        b.addEventListener('pointercancel', stop);
      });
      this.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
          if (e.target !== this && e.composedPath()[0].tagName === 'A') return;
          e.preventDefault(); this._keys.add(k);
        }
      });
      this.addEventListener('keyup', (e) => this._keys.delete(e.key.toLowerCase()));
      this.addEventListener('blur', () => this._keys.clear());

      const map = sr.querySelector('.map');
      map.addEventListener('click', (e) => {
        if (!this._plan) return;
        const r = map.getBoundingClientRect();
        const p = this._fromMap((e.clientX - r.left) / r.width * map.width, (e.clientY - r.top) / r.height * map.height);
        if (!this._blocked(p.x, p.z)) { this._pos = p; this._setView('walk', true); }
      });

      const gl = sr.querySelector('.gl');
      let drag = null;
      gl.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; gl.setPointerCapture(e.pointerId); this.focus({ preventScroll: true }); this._turnTo = null; });
      gl.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag = { x: e.clientX, y: e.clientY };
        if (this._view === 'walk') {
          this._yaw += dx * 0.005;
          this._pitch = Math.max(-1.1, Math.min(1.1, this._pitch + dy * 0.004));
        } else this._az += dx * 0.006;
      });
      const end = () => { drag = null; };
      gl.addEventListener('pointerup', end);
      gl.addEventListener('pointercancel', end);
    }

    _msg(t) { const m = this.$('.msg'); if (!m) return; m.textContent = t || ''; m.hidden = !t; }

    _applyPlan() {
      const p = this._plan;
      if (!p || !this.shadowRoot.firstChild) return;
      this._heights = p.heights && p.heights.length ? p.heights : DEFAULT_HEIGHTS;
      const vs = p.variants || [];
      // a plan with the same id is the same place updated live (a form, a slider): keep where the viewer stands
      const same = p.id != null && p.id === this._planId && this._variant !== undefined;
      this._planId = p.id;
      if (!same || !vs.find((v) => v.id === this._variant)) {
        const want = this.getAttribute('variant');
        this._variant = vs.find((v) => v.id === want) ? want : (vs[0] && vs[0].id) || null;
      }
      if (!same) {
        const eyeAttr = +this.getAttribute('eye');
        const h = this._heights.find((x) => x.cm === eyeAttr) || this._heights[0];
        this._eyeCm = h.cm; this._eye = h.cm / 100;
        if (this.getAttribute('view') === 'top') this._view = 'top';
        const s = p.spawn || {};
        this._pos = { x: s.x || 0, z: s.z || 0 };
        this._yaw = ((s.yaw || 0) * Math.PI) / 180;
        this._pitch = 0;
      }

      this.$('.title').textContent = p.title || '';
      this.$('.vars').innerHTML = vs.map((v) => `<button class="opt" data-variant="${esc(v.id)}" data-tone="${esc(v.tone || '')}">${esc(v.label)}</button>`).join('');
      this.$('.rule').innerHTML = rich(p.rule || 'חוסם: חלק אטום שהחלק העליון שלו מגיע לגובה העיניים או מעליו. גדר שקופה וזכוכית לא חוסמות. חלון נמדד לפי האדן. מגבלה: בדיקת גובה בלבד, בלי מרחק וזווית.');
      this.$('.src').innerHTML = p.source ? rich(p.source) : '';
      this._render();
      if (this._booted) this._rebuild(); else this._boot();
    }

    _setEye(c, user) { this._eyeCm = c; if (this._reduce) this._eye = c / 100; this._render(); if (user) this._emit(); }
    _setVariant(id, user) { this._variant = id; this._rebuild(); this._render(); if (user) this._emit(); }
    _setView(v, user) { this._view = v; this._render(); if (user) this._emit(); }
    _emit() { this.dispatchEvent(new CustomEvent('walkchange', { detail: { eye: this._eyeCm, variant: this._variant, view: this._view }, bubbles: true, composed: true })); }

    _items() { return this._plan ? itemsOf(this._plan, this._variant) : []; }

    /* ---------- panel ---------- */
    _render() {
      const p = this._plan; if (!p) return;
      const ev = evaluate(p, this._variant, this._eyeCm);
      const per = this._heights.map((h) => ({ h, n: evaluate(p, this._variant, h.cm).blocks }));
      this.$('.heights').innerHTML = per.map(({ h, n }) => `
        <button class="opt" data-eye="${h.cm}" aria-pressed="${h.cm === this._eyeCm}">
          <span class="n">${h.cm}<span class="u"> ס״מ</span></span><span class="who">${esc(h.label)}</span>
          ${ev.total ? `<span class="cnt ${n ? '' : 'zero'}">${n ? n + ' חוסמים' : 'פתוח'}</span>` : ''}</button>`).join('');
      this.shadowRoot.querySelectorAll('.vars .opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.variant === this._variant)));
      this.shadowRoot.querySelectorAll('.views .opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === this._view)));
      const v = (p.variants || []).find((x) => x.id === this._variant);
      this.$('.vnote').innerHTML = v && v.note ? rich(v.note) : '';

      const here = this._heights.find((h) => h.cm === this._eyeCm) || { cm: this._eyeCm, label: '' };
      this.$('.sight-lbl').hidden = !ev.total;
      const sum = p.summary || ((p.variants || []).find((x) => x.id === this._variant) || {}).summary;
      if (sum && !ev.total) {
        this.$('.insight').innerHTML = rich(sum.insight || '');
        this.$('.explain').innerHTML = rich(sum.explain || '');
      } else if (!ev.total) {
        this.$('.insight').innerHTML = `מגובה <b>${here.cm} ס״מ</b>`;
        this.$('.explain').textContent = 'בתוכנית הזו אין אלמנטים שנמדדים לקו מבט.';
      } else if (!ev.blocks) {
        this.$('.insight').innerHTML = `מגובה <b>${here.cm} ס״מ</b> רואים הכול`;
        this.$('.explain').innerHTML = `אף אלמנט אטום לא עולה לגובה העיניים: <b>0 מתוך ${ev.total}</b> חוסמים.`;
      } else {
        this.$('.insight').innerHTML = `מגובה <b>${here.cm} ס״מ</b>: <b>${ev.blocks} מתוך ${ev.total}</b> חוסמים`;
        const top = per[per.length - 1];
        this.$('.explain').innerHTML = top.h.cm !== here.cm && top.n < ev.blocks
          ? `מגובה <b>${top.h.cm} ס״מ</b> חוסמים רק <b>${top.n}</b>. מי שמתכנן בעמידה לא רואה את מה שהילד רואה.`
          : `החלק העליון של כל אחד מהם מגיע לגובה העיניים או מעליו.`;
      }

      const refBase = this.getAttribute('ref-base');
      const ref = (it) => it.ref && it.refLabel
        ? `<span class="ref">${refBase ? `<a href="${esc(refBase + it.ref)}">עיקרון: ${esc(it.refLabel)}</a>` : `עיקרון: ${esc(it.refLabel)}`}</span>` : '';
      const ST = { block: 'חוסם', clear: 'רואים מעליו', through: 'שקוף' };
      this.$('.sight').innerHTML = ev.rows.map(({ it, state }) => `
        <li><button class="row" data-id="${esc(it.id)}" data-s="${state}">
          <span class="bar"></span>
          <span><span class="name">${esc(it.label)}</span>${ref(it)}</span>
          <span class="val">${cm(blockTop(it))} ס״מ<span class="st">${ST[state]}</span></span>
        </button></li>`).join('');

      const checks = this._items().filter((it) => it.check);
      this.$('.checks-lbl').hidden = !checks.length;
      this.$('.checks').innerHTML = checks.map((it) => `
        <li><button class="row" data-id="${esc(it.id)}" data-s="${it.check === 'ok' ? 'ok' : 'fail'}">
          <span class="bar"></span>
          <span><span class="name">${esc(it.label)}</span>${ref(it)}</span>
          <span class="val">${esc(it.value || '')}<span class="st">${it.check === 'ok' ? 'תואם' : 'לא תואם'}</span></span>
        </button></li>`).join('');
      this._eyeTag();
    }

    _eyeTag() {
      const e = this.$('.eye'); if (!e) return;
      const h = this._heights && this._heights.find((x) => x.cm === this._eyeCm);
      e.innerHTML = this._view === 'top' ? 'מבט על' : `גובה עיניים <b>${this._eyeCm} ס״מ</b>${h ? ' · ' + esc(h.label) : ''}`;
    }

    /* ---------- 3D ---------- */
    async _boot() {
      if (this._booted || this._booting) { if (this._booted) this._rebuild(); return; }
      this._booting = true;
      let T;
      try { T = await import(this.getAttribute('three') || THREE_URL); } catch (e) {
        this._booting = false;
        this._msg('התלת־ממד לא נטען. בדקו חיבור לרשת ורעננו. הרשימה בצד מחושבת גם בלעדיו.');
        return;
      }
      this.T = T;
      const canvas = this.$('.gl');
      let r;
      try { r = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); } catch (e) {
        this._booting = false;
        this._msg('הדפדפן הזה לא מציג תלת־ממד. הרשימה בצד מחושבת גם בלעדיו.');
        return;
      }
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFSoftShadowMap;
      this._renderer = r;
      const p = this._plan;
      const scene = (this._scene = new T.Scene());
      const sky = new T.Color(p.sky || '#dfe5e8');
      scene.background = sky;
      scene.fog = new T.Fog(sky, 22, 60);
      this._cam = new T.PerspectiveCamera(68, 1, 0.05, 200);
      this._cam.rotation.order = 'YXZ';
      scene.add(new T.HemisphereLight(0xffffff, 0x8c7b6b, 1.5));
      const sun = new T.DirectionalLight(0xfff4e0, 2.4);
      sun.position.set(-9, 16, 7); // one light source, upper left, for the whole family of apps
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, far: 60 });
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      this._sun = sun;

      // you, seen from above
      const me = (this._me = new T.Group());
      const body = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1, 20), new T.MeshStandardMaterial({ color: p.meColor || '#1a1a18' }));
      body.position.y = 0.5; body.castShadow = true;
      const nose = new T.Mesh(new T.ConeGeometry(0.16, 0.5, 16), new T.MeshStandardMaterial({ color: '#f3e37c' }));
      nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.9, -0.38);
      me.add(body, nose);
      scene.add(me);

      this._mats = new Map();
      this._group = new T.Group();
      scene.add(this._group);
      this._rebuild();

      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.$('.stage'));
      this._resize();
      this._booted = true;
      this._booting = false;
      this._msg('');
      let last = performance.now();
      const tick = (t) => {
        this._raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (t - last) / 1000); last = t;
        if (document.hidden) return;
        this._step(dt, t);
        r.render(scene, this._cam);
        this._drawMap();
      };
      this._raf = requestAnimationFrame(tick);
    }

    _resize() {
      if (!this._renderer) return;
      const s = this.$('.stage').getBoundingClientRect();
      if (!s.width || !s.height) return;
      this._renderer.setSize(s.width, s.height, false);
      this._cam.aspect = s.width / s.height;
      this._cam.updateProjectionMatrix();
    }

    _mat(color, extra) {
      const key = color + JSON.stringify(extra || {});
      if (!this._mats.has(key)) this._mats.set(key, new this.T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, extra)));
      return this._mats.get(key);
    }

    _box(g, w, h, d, x, y0, z, color, extra, shadow = true) {
      const T = this.T;
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), this._mat(color, extra));
      m.position.set(x, y0 + h / 2, z);
      m.castShadow = shadow; m.receiveShadow = true;
      g.add(m);
      return m;
    }

    _rebuild() {
      if (!this.T || !this._group) return;
      const T = this.T, p = this._plan;
      const [x0, z0, x1, z1] = p.bounds || [-10, -10, 10, 10];
      const R = Math.max(x1 - x0, z1 - z0) / 2 + 2;
      if (this._ground) { this._ground.geometry.dispose(); this._scene.remove(this._ground); }
      const ground = (this._ground = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), new T.MeshStandardMaterial({ color: p.ground || '#d9d3c4', roughness: 1 })));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      ground.receiveShadow = true;
      this._scene.add(ground);
      const sh = this._sun.shadow.camera;
      Object.assign(sh, { left: -R, right: R, top: R, bottom: -R, far: R * 4 + 40 });
      sh.updateProjectionMatrix();
      this._sun.position.set((x0 + x1) / 2 - R * 0.55, R + 14, (z0 + z1) / 2 + R * 0.45);
      this._sun.target.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      this._sun.target.updateMatrixWorld();
      this._scene.fog.near = Math.max(22, R * 1.4); this._scene.fog.far = Math.max(60, R * 4);
      this._cam.far = Math.max(200, R * 8); this._cam.updateProjectionMatrix();
      this._group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this._group.clear();
      this._objs = new Map();
      for (const it of this._items()) {
        if (it.type === 'note') continue;
        const g = new T.Group();
        g.position.set(it.x || 0, 0, it.z || 0);
        g.rotation.y = ((it.rot || 0) * Math.PI) / 180;
        this._part(g, it);
        this._group.add(g);
        if (it.id) this._objs.set(it.id, g);
      }
    }

    _part(g, it) {
      const T = this.T;
      const w = it.w || 1, d = it.d || 1, h = it.h || 1, y0 = it.y0 || 0;
      const c = it.color;
      switch (it.type) {
        case 'prism': {
          // a real footprint from a map: points [[x, z], ...] in meters, extruded from y0 to y0 + h
          const pts = it.points || [];
          if (pts.length < 3) break;
          const shape = new T.Shape(pts.map(([px, pz]) => new T.Vector2(px, -pz)));
          const geo = new T.ExtrudeGeometry(shape, { depth: Math.max(0.02, h), bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          const flat = h <= 0.05;
          const m = new T.Mesh(geo, this._mat(c || (it.glass ? '#9fb4c2' : '#e4e0d8'), it.glass ? { transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false } : flat ? { roughness: 1 } : null));
          m.position.y = y0 + (flat ? 0.002 + (it.layer || 0) * 0.004 : 0);
          m.castShadow = !it.glass && !flat; m.receiveShadow = true;
          g.add(m);
          break;
        }
        case 'surface': {
          const m = this._box(g, w, 0.02, d, 0, 0.002 + (it.layer || 0) * 0.004, 0, c || '#bbb', null, false);
          m.castShadow = false;
          break;
        }
        case 'hedge':
          this._box(g, w, h, d, 0, y0, 0, c || '#4f7a45', { roughness: 1 });
          break;
        case 'planter':
          this._box(g, w, h - 0.08, d, 0, y0, 0, it.base || '#b9b1a3');
          this._box(g, w - 0.1, 0.08, d - 0.1, 0, h - 0.08, 0, c || '#5d8a4f', { roughness: 1 });
          break;
        case 'fence': {
          const along = w >= d, len = along ? w : d, step = it.step || 0.13, n = Math.max(2, Math.floor(len / step));
          const slat = new T.InstancedMesh(new T.BoxGeometry(along ? 0.035 : d, h, along ? d : 0.035), this._mat(c || '#2d4a3e'), n + 1);
          const mx = new T.Matrix4();
          for (let i = 0; i <= n; i++) {
            const o = -len / 2 + (i * len) / n;
            mx.makeTranslation(along ? o : 0, y0 + h / 2, along ? 0 : o);
            slat.setMatrixAt(i, mx);
          }
          slat.castShadow = true;
          g.add(slat);
          this._box(g, along ? len : d + 0.02, 0.05, along ? d + 0.02 : len, 0, y0 + h - 0.05, 0, c || '#2d4a3e');
          break;
        }
        case 'window': {
          const sill = it.sill || 0, top = it.top || 2.2;
          this._box(g, w, sill, d, 0, 0, 0, it.wall || '#e4ddd0');
          this._box(g, w, top - sill, d * 0.5, 0, sill, 0, '#6d8a99', { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.3 }, false);
          this._box(g, w + 0.08, 0.06, d + 0.04, 0, sill - 0.03, 0, '#2b2b28');
          this._box(g, w + 0.08, 0.06, d + 0.04, 0, top, 0, '#2b2b28');
          break;
        }
        case 'glass':
          this._box(g, w, h, d, 0, y0, 0, c || '#6d8a99', { transparent: true, opacity: 0.4, roughness: 0.1 }, false);
          break;
        case 'car': {
          const bodyH = h * 0.52;
          this._box(g, w, bodyH, d, 0, 0.18, 0, c || '#8a3b2f', { roughness: 0.4, metalness: 0.3 });
          this._box(g, w * 0.58, h - bodyH - 0.18, d * 0.92, -w * 0.05, 0.18 + bodyH, 0, '#3c4a52', { roughness: 0.2, metalness: 0.4 });
          const wheel = new T.CylinderGeometry(0.32, 0.32, 0.22, 18);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const m = new T.Mesh(wheel, this._mat('#1d1d1b'));
            m.rotation.x = Math.PI / 2; m.position.set(sx * w * 0.32, 0.32, sz * (d / 2 - 0.05)); m.castShadow = true;
            g.add(m);
          }
          break;
        }
        case 'bench': {
          const seat = it.seat || 0.45;
          this._box(g, w, 0.06, d, 0, seat - 0.06, 0, c || '#8c6a4a');
          this._box(g, w, 0.4, 0.05, 0, seat + 0.03, d / 2 - 0.03, c || '#8c6a4a');
          for (const sx of [-1, 1]) this._box(g, 0.06, seat - 0.06, d, sx * (w / 2 - 0.1), 0, 0, '#3a3a36');
          break;
        }
        case 'shade': {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._box(g, 0.1, h, 0.1, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), '#3a3a36');
          this._box(g, w, 0.08, d, 0, h, 0, c || '#c9b48a', { roughness: 1 });
          break;
        }
        case 'pole': {
          const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, h, 12), this._mat('#3a3a36'));
          m.position.y = h / 2; m.castShadow = true; g.add(m);
          this._box(g, 0.5, 0.12, 0.25, 0.2, h - 0.12, 0, '#2b2b28');
          break;
        }
        case 'tree': {
          const r = (it.crown || w) / 2;
          const trunk = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, h - r, 10), this._mat('#6a5240'));
          trunk.position.y = (h - r) / 2; trunk.castShadow = true; g.add(trunk);
          const crown = new T.Mesh(new T.IcosahedronGeometry(r, 1), this._mat(c || '#4e7d46', { roughness: 1, flatShading: true }));
          crown.position.y = h - r * 0.7; crown.castShadow = true; g.add(crown);
          break;
        }
        case 'play': {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) this._box(g, 0.1, h, 0.1, sx * (w / 2), 0, sz * (d / 2), c || '#c5502e');
          this._box(g, w, 0.08, d, 0, h * 0.5, 0, '#e7c15a');
          this._box(g, w + 0.1, 0.08, 0.08, 0, h, -d / 2, c || '#c5502e');
          const slide = this._box(g, 0.6, 0.05, 2.2, 0, 0, d / 2 + 0.9, '#3f7aa0');
          slide.position.y = h * 0.25; slide.rotation.x = Math.atan2(h * 0.5, 2.2);
          break;
        }
        default:
          this._box(g, w, h, d, 0, y0, 0, c || '#cfc8ba');
      }
    }

    _aabbs() {
      return this._items().filter((it) => SOLID.includes(it.type) && it.solid !== false).map((it) => {
        const q = Math.abs(Math.round((it.rot || 0) / 90)) % 2 === 1;
        const w = (q ? it.d : it.w) || 1, d = (q ? it.w : it.d) || 1;
        return [it.x - w / 2 - 0.22, it.z - d / 2 - 0.22, it.x + w / 2 + 0.22, it.z + d / 2 + 0.22];
      });
    }

    _blocked(x, z) {
      const [x0, z0, x1, z1] = this._plan.bounds || [-10, -10, 10, 10];
      if (x < x0 + 0.3 || x > x1 - 0.3 || z < z0 + 0.3 || z > z1 - 0.3) return true;
      if (this._aabbs().some((b) => x > b[0] && x < b[2] && z > b[1] && z < b[3])) return true;
      return this._items().some((it) => it.type === 'prism' && it.solid !== false && opaque(it) && it.points && inPoly(x - (it.x || 0), z - (it.z || 0), it.points));
    }

    _lookAt(id) {
      const it = this._items().find((x) => x.id === id);
      if (!it) return;
      this._flash = { id, until: performance.now() + 1800 };
      let tx = it.x, tz = it.z;
      if (it.type === 'prism' && it.points && it.points.length) {
        tx = (it.x || 0) + it.points.reduce((a, q) => a + q[0], 0) / it.points.length;
        tz = (it.z || 0) + it.points.reduce((a, q) => a + q[1], 0) / it.points.length;
      }
      if (this._view === 'walk' && tx != null) {
        const yaw = Math.atan2(-(tx - this._pos.x), -(tz - this._pos.z));
        let dy = yaw - this._yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this._turnTo = this._yaw + dy;
        if (this._reduce) { this._yaw = this._turnTo; this._turnTo = null; }
        this._pitch = -0.08;
      }
    }

    _step(dt, now) {
      const k = this._keys;
      const target = this._eyeCm / 100;
      this._eye += this._reduce ? target - this._eye : (target - this._eye) * Math.min(1, dt * 5);
      if (this._turnTo != null) {
        this._yaw += (this._turnTo - this._yaw) * Math.min(1, dt * 6);
        if (Math.abs(this._turnTo - this._yaw) < 0.002) this._turnTo = null;
      }
      if (k.has('arrowleft')) this._yaw += dt * 1.6;
      if (k.has('arrowright')) this._yaw -= dt * 1.6;
      let fwd = this._move;
      if (k.has('arrowup') || k.has('w')) fwd += 1;
      if (k.has('arrowdown') || k.has('s')) fwd -= 1;
      let side = 0;
      if (k.has('d')) side += 1;
      if (k.has('a')) side -= 1;
      if ((fwd || side) && this._view === 'walk') {
        const sp = (this._plan.speed || 1.8) * dt, s = Math.sin(this._yaw), c = Math.cos(this._yaw);
        const dx = (-s * fwd + c * side) * sp, dz = (-c * fwd - s * side) * sp;
        if (!this._blocked(this._pos.x + dx, this._pos.z)) this._pos.x += dx;
        if (!this._blocked(this._pos.x, this._pos.z + dz)) this._pos.z += dz;
      }
      const cam = this._cam;
      this._me.position.set(this._pos.x, 0, this._pos.z);
      this._me.rotation.y = this._yaw;
      this._me.scale.y = Math.max(0.4, this._eye);
      if (this._view === 'walk') {
        this._me.visible = false;
        cam.fov = 68;
        cam.position.set(this._pos.x, this._eye, this._pos.z);
        cam.rotation.set(this._pitch, this._yaw, 0);
      } else {
        this._me.visible = true;
        cam.fov = 45;
        const [x0, z0, x1, z1] = this._plan.bounds || [-10, -10, 10, 10];
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.max(x1 - x0, z1 - z0) * 1.05;
        cam.position.set(cx + Math.sin(this._az) * R, R * 1.05, cz + Math.cos(this._az) * R);
        cam.lookAt(cx, 0, cz);
      }
      cam.updateProjectionMatrix();

      // the element picked in the list glows for a moment
      const f = this._flash;
      for (const [id, g] of this._objs || []) {
        const on = f && f.id === id && now < f.until;
        const glow = on ? 0.35 + 0.35 * Math.sin(now / 120) : 0;
        g.traverse((o) => {
          if (!o.material) return;
          if (on && !o.userData.own) { o.material = o.material.clone(); o.userData.own = true; }
          if (o.userData.own) o.material.emissive && o.material.emissive.setRGB(glow, glow * 0.85, glow * 0.2);
        });
      }
      if (this._lastView !== this._view) { this._lastView = this._view; this._eyeTag(); }
    }

    _mapFit() {
      const c = this.$('.map');
      const [x0, z0, x1, z1] = this._plan.bounds || [-10, -10, 10, 10];
      const pad = 12, s = Math.min((c.width - pad * 2) / (x1 - x0), (c.height - pad * 2) / (z1 - z0));
      const ox = (c.width - (x1 - x0) * s) / 2, oz = (c.height - (z1 - z0) * s) / 2;
      return { c, s, X: (x) => ox + (x - x0) * s, Z: (z) => oz + (z - z0) * s, x0, z0, ox, oz };
    }
    _fromMap(px, pz) { const f = this._mapFit(); return { x: f.x0 + (px - f.ox) / f.s, z: f.z0 + (pz - f.oz) / f.s }; }

    _drawMap() {
      const f = this._mapFit(), ctx = f.c.getContext('2d'), cs = getComputedStyle(this);
      const col = (v, d) => (cs.getPropertyValue(v).trim() || d);
      const P = col('--sw-problem', '#b8472e'), S = col('--sw-solution', '#2d6a4e'), INK = col('--sw-ink', '#1a1a18');
      ctx.clearRect(0, 0, f.c.width, f.c.height);
      ctx.fillStyle = this._plan.ground || '#d9d3c4';
      ctx.fillRect(f.X(f.x0), f.Z(f.z0), (this._plan.bounds[2] - f.x0) * f.s, (this._plan.bounds[3] - f.z0) * f.s);
      const eye = this._eyeCm / 100;
      const order = (it) => (it.type === 'surface' || (it.type === 'prism' && (it.h || 0) <= 0.05) ? 0 : it.glass ? 2 : 1);
      for (const it of this._items().filter((x) => x.type !== 'note').sort((a, b) => order(a) - order(b))) {
        const q = Math.abs(Math.round((it.rot || 0) / 90)) % 2 === 1;
        const w = (q ? it.d : it.w) || 1, d = (q ? it.w : it.d) || 1;
        let fill = it.type === 'surface' ? it.color || '#bbb' : '#a49d90';
        if (counted(it)) fill = sightState(it, eye) === 'block' ? P : S;
        if (it.type === 'prism') {
          if (!it.points || it.points.length < 3) continue;
          const ox = it.x || 0, oz = it.z || 0;
          ctx.beginPath();
          it.points.forEach(([px, pz], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, f.X(px + ox), f.Z(pz + oz)));
          ctx.closePath();
          ctx.globalAlpha = it.glass ? 0.3 : 1;
          ctx.fillStyle = counted(it) ? fill : it.mapColor || it.color || '#a49d90';
          ctx.fill();
          ctx.globalAlpha = 1;
          if (this._flash && this._flash.id === it.id && performance.now() < this._flash.until) { ctx.strokeStyle = '#f3e37c'; ctx.lineWidth = 4; ctx.stroke(); }
          continue;
        }
        if (it.type === 'tree') { ctx.fillStyle = '#7ea26f'; ctx.beginPath(); ctx.arc(f.X(it.x), f.Z(it.z), ((it.crown || it.w || 1) / 2) * f.s, 0, 7); ctx.fill(); continue; }
        ctx.fillStyle = fill;
        const fl = this._flash && this._flash.id === it.id && performance.now() < this._flash.until;
        ctx.globalAlpha = it.type === 'shade' ? 0.35 : 1;
        ctx.fillRect(f.X(it.x - w / 2), f.Z(it.z - d / 2), Math.max(2, w * f.s), Math.max(2, d * f.s));
        ctx.globalAlpha = 1;
        if (fl) { ctx.strokeStyle = '#f3e37c'; ctx.lineWidth = 4; ctx.strokeRect(f.X(it.x - w / 2) - 3, f.Z(it.z - d / 2) - 3, w * f.s + 6, d * f.s + 6); }
      }
      // view cone and you
      const x = f.X(this._pos.x), z = f.Z(this._pos.z), a = -this._yaw - Math.PI / 2, R = 46;
      ctx.fillStyle = 'rgba(243, 227, 124, .55)';
      ctx.beginPath(); ctx.moveTo(x, z); ctx.arc(x, z, R, a - 0.6, a + 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, z, 7, 0, 7); ctx.fill();
    }
  }

  SpaceWalk.evaluate = evaluate;
  customElements.define('space-walk', SpaceWalk);
})();
