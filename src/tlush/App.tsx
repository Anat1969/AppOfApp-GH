import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSlips } from './store';
import { UploadButton, UploaderProvider } from './Upload';
import type { Slip } from './types';
import { Flow, Home, Method, Owed, Pension, Rules, Save, SlipView, Time, VIEWS, type View } from './Views';

interface MenuElement extends HTMLElement { items: { label: string; hint?: string; danger?: boolean; onSelect: () => unknown }[]; status: string }
// The 'ai-menu' JSX type is declared once, in src/components/AIMenu.tsx.
const CHAT = 'https://claude.ai/code/session_01UBnSCMqDJ9KyRzhSSamBCm';

const readUrl = () => {
  const q = new URLSearchParams(location.search);
  const v = q.get('v') as View | null;
  return { view: VIEWS.some((x) => x.id === v) ? v! : 'home', month: q.get('m') ?? undefined };
};

export default function App() {
  const { slips, params, add, remove, clear, setParams, replaceAll, savedAt } = useSlips();
  const [{ view, month }, setRoute] = useState(readUrl);
  const reduce = useReducedMotion();
  const menu = useRef<MenuElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  const go = useCallback((v: View, m?: string) => {
    const q = new URLSearchParams();
    if (v !== 'home') q.set('v', v);
    if (m) q.set('m', m);
    history.pushState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
    setRoute((cur) => {
      // A month switch keeps the reader where they are; only a new page starts at the top.
      if (cur.view !== v) scrollTo({ top: 0, behavior: 'auto' });
      return { view: v, month: m };
    });
  }, []);

  useEffect(() => { const on = () => setRoute(readUrl()); addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, []);
  useEffect(() => { document.title = `${VIEWS.find((x) => x.id === view)!.label} · מה יש בתלוש שלי`; }, [view]);

  const backup = useCallback(() => {
    const blob = new Blob([JSON.stringify({ slips, params, at: new Date().toISOString() }, null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `tlush-backup-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  }, [slips, params]);

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    el.items = [
      { label: 'גיבוי הנתונים לקובץ', hint: `${slips.length} תלושים`, onSelect: backup },
      { label: 'טעינת גיבוי', hint: 'ממכשיר אחר', onSelect: () => fileIn.current?.click() },
      { label: 'מחיקת כל התלושים מהמכשיר', hint: 'דורש אישור', danger: true, onSelect: () => { if (confirm('למחוק את כל התלושים מהמכשיר הזה? אי אפשר לשחזר בלי קובץ גיבוי.')) clear(); } },
    ];
    el.status = savedAt && slips.length ? `נשמר במכשיר ${new Date(savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : '';
  }, [slips.length, savedAt, backup, clear]);

  const restore = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as { slips: Slip[]; params?: object };
      if (!Array.isArray(data.slips)) throw new Error();
      replaceAll(data.slips, data.params);
      alert(`נטענו ${data.slips.length} תלושים.`);
    } catch { alert('זה לא קובץ גיבוי של האפליקציה.'); }
  };

  const props = { slips, params, setParams, go, month, onSlip: add, onRemove: remove };
  const current = VIEWS.find((x) => x.id === view)!;
  const Page = { home: Home, slip: SlipView, flow: Flow, rules: Rules, owed: Owed, save: Save, pension: Pension, time: Time, method: Method }[view];
  const okCount = slips.filter((s) => !s.warnings.length).length;
  const badge = slips.length > 0 && (
    <button type="button" className={`match-badge ${okCount < slips.length ? 'bad' : ''}`} onClick={() => go('method')} title="מה נבדק בכל תלוש">
      {`בדיקת התאמה: ${okCount} מתוך ${slips.length} תואמים`}
    </button>
  );

  return (
    <UploaderProvider onSlip={add} has={(id) => slips.some((s) => s.id === id)}>
      <header className="bar">
        <a className="brand" href={location.pathname} onClick={(e) => { e.preventDefault(); go('home'); }}>
          <span className="brand-mark" aria-hidden="true">₪</span>
          <span>מה יש בתלוש שלי</span>
        </a>
        <nav className="nav" aria-label="חלקי האפליקציה">
          {VIEWS.slice(1).map((v) => (
            <button key={v.id} type="button" className={`nav-btn ${view === v.id ? 'on' : ''}`} aria-current={view === v.id ? 'page' : undefined} onClick={() => go(v.id)}>{v.label}</button>
          ))}
        </nav>
        <ai-menu ref={menu} chat={CHAT} />
      </header>
      <input ref={fileIn} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ''; }} />
      <main className="main">
        {view !== 'home' && (
          <div className="page-head">
            <nav className="crumbs" aria-label="מיקום"><a href={location.pathname} onClick={(e) => { e.preventDefault(); go('home'); }}>בית</a><span>/</span><span>{current.label}</span></nav>
            <h1>{current.title}</h1>
          </div>
        )}
        {/* The sticky band: page controls (portal slot) and the tools, always in the same place. */}
        <div className="band">
          <div id="band-slot" className="band-slot" />
          <div className="page-tools">{badge}{view !== 'home' && <UploadButton />}</div>
        </div>
        {/* Fade only: no vertical movement, no exit wait, so the bars never jump. */}
        <motion.div key={view} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
          <Page {...props} />
        </motion.div>
      </main>
      <footer className="foot">
        <span>הנתונים נשמרים רק בדפדפן הזה. אין שרת, אין חשבון, ושום תלוש לא נשלח.</span>
        <span>החישובים הם הערכה לתכנון, לא ייעוץ פנסיוני או מס.</span>
      </footer>
    </UploaderProvider>
  );
}
