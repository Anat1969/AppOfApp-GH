import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ActionValue, AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { ACTIONS, actionOf } from '../lib/facets';
import { siteUrl, thumbOf } from '../lib/format';
import { GAP_IDEAS, gapKey } from '../data/gapIdeas';
import { toast } from './Toasts';

export interface AddPrefill {
  name?: string;
  desc?: string;
  action?: ActionValue;
  domain?: string;
}

interface Props {
  apps: AppData[];
  facets: Facet[];
  sheets: Map<string, string>;
  go: (p: Partial<Route>) => void;
  onAdd: (p: AddPrefill) => void;
}

interface Open {
  domain: string;
  action: ActionValue;
  x: number;
  y: number;
  /** Opens above the cell when there is more room above than below. */
  above: boolean;
  room: number;
  pinned: boolean;
}

/** The ready prompt for Claude Code that turns a gap idea into an app. */
function buildPrompt(title: string, idea: string, action: string, domain: string, near: AppData[]) {
  const refs = near.map((a) => `- ${a.name}${siteUrl(a) ? `: ${siteUrl(a)}` : ''}`).join('\n');
  return `אני בונה אפליקציה חדשה: ${title}.
${idea}
פעולה: ${action}. תחום: ${domain}.
${refs ? `אפליקציות קיימות שלי שאפשר להישען עליהן ולקשר אליהן:\n${refs}\n` : ''}
עבוד לפי הסקיל anat-app-builder: אפיון קצר בתוך התשובה, ואז בנייה מקצה לקצה. עברית ו-RTL, בלי אייקונים, כפתור הלוגו A&I, התקנה מ-Chrome, בדיקות Playwright, פריסה ל-Vercel ומיזוג ל-main.
AI בתוך האפליקציה: Gemini החינמי (GEMINI_API_KEY) דרך פונקציית Edge, Claude רק כגיבוי. כל טקסט שה-AI כותב לפי תקן הזיקוק: שורת תובנה עד 8 מילים, משפט הסבר עד 20 מילים, והבלטות ב-** למושג המרכזי, לפרמטרים ולמספרים (https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-text-standard.md).
לפני הבנייה: uipro init --ai claude
בסוף: הוסף את האפליקציה לתיק העבודות https://appofapp-gh.vercel.app עם פעולה "${action}" ותחום "${domain}".`;
}

/** Domain against action. Every cell is a door; an empty cell is a gap with a suggested app. */
export default function Matrix({ apps, facets, sheets, go, onAdd }: Props) {
  const domains = facets.filter((f) => f.kind === 'domain');
  const cellApps = (d: string, a: ActionValue) => apps.filter((x) => x.action === a && x.domains?.includes(d));
  const max = Math.max(1, ...domains.flatMap((d) => ACTIONS.map((a) => cellApps(d.value, a.value).length)));
  const [open, setOpen] = useState<Open | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const pop = useRef<HTMLDivElement>(null);

  const show = (domain: string, action: ActionValue, el: HTMLElement, pinned = false) => {
    clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    const below = innerHeight - r.bottom - 16;
    const above = below < 320 && r.top > below;
    setOpen({ domain, action, x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above, room: Math.max(160, (above ? r.top : below) - 16), pinned });
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen((o) => (o?.pinned ? o : null)), 180);
  };

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    const out = (e: PointerEvent) => {
      if (pop.current && !pop.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.cell, .gap')) setOpen(null);
    };
    const y0 = scrollY;
    const scroll = () => Math.abs(scrollY - y0) > 60 && setOpen(null);
    addEventListener('keydown', k);
    addEventListener('pointerdown', out);
    addEventListener('scroll', scroll, { passive: true });
    return () => {
      removeEventListener('keydown', k);
      removeEventListener('pointerdown', out);
      removeEventListener('scroll', scroll);
    };
  }, [open]);

  const d = open && facets.find((f) => f.kind === 'domain' && f.value === open.domain);
  const a = open && actionOf(open.action);
  const list = open ? cellApps(open.domain, open.action) : [];
  const idea = open && !list.length ? GAP_IDEAS[gapKey(open.domain, open.action)] : undefined;
  // Raw material for a gap: apps in the same row (domain) and the same column (action).
  const near = open && !list.length
    ? [...apps.filter((x) => x.domains?.includes(open.domain)).slice(0, 2), ...apps.filter((x) => x.action === open.action).slice(0, 2)]
        .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    : [];

  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th className="corner mono">תחום / פעולה</th>
            {ACTIONS.map((ac) => (
              <th key={ac.value} scope="col">
                <button className="axis" onClick={() => go({ action: ac.value, domain: null, app: null })} title={ac.question}>
                  {ac.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map((dm, i) => (
            <tr key={dm.value}>
              <th scope="row">
                <button className="axis" onClick={() => go({ domain: dm.value, action: null, app: null })}>
                  {dm.label}
                </button>
              </th>
              {ACTIONS.map((ac) => {
                const cell = cellApps(dm.value, ac.value);
                const n = cell.length;
                const isOpen = open?.domain === dm.value && open.action === ac.value;
                return (
                  <td key={ac.value}>
                    {n ? (
                      <motion.button
                        className={`cell ${isOpen ? 'on' : ''}`}
                        style={{ ['--d' as string]: n / max }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.03 }}
                        onPointerEnter={(e) => e.pointerType === 'mouse' && show(dm.value, ac.value, e.currentTarget)}
                        onPointerLeave={hideSoon}
                        onFocus={(e) => show(dm.value, ac.value, e.currentTarget)}
                        onClick={() => go({ domain: dm.value, action: ac.value, app: null })}
                        aria-label={`${dm.label}, ${ac.label}: ${n} אפליקציות`}
                      >
                        <span className="cell-stack" aria-hidden>
                          {cell.slice(0, 3).map((x, k) => {
                            const t = thumbOf(x);
                            return t ? <img key={x.id} src={t} alt="" loading="lazy" style={{ ['--k' as string]: k }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : null;
                          })}
                        </span>
                        <span className="cell-n mono">{n}</span>
                      </motion.button>
                    ) : (
                      <button
                        className={`gap ${isOpen ? 'on' : ''}`}
                        onPointerEnter={(e) => e.pointerType === 'mouse' && show(dm.value, ac.value, e.currentTarget)}
                        onPointerLeave={hideSoon}
                        onClick={(e) => show(dm.value, ac.value, e.currentTarget, true)}
                        aria-label={`פער: ${ac.label} ב${dm.label}. הצעה לאפליקציה חדשה`}
                      >
                        <span className="gap-mark mono">הצעה</span>
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <AnimatePresence>
        {open && d && a && (
          <motion.div
            ref={pop}
            key={`${open.domain}:${open.action}`}
            className="cell-pop"
            role="dialog"
            aria-label={`${d.label}, ${a.label}`}
            style={{
              top: open.y,
              left: Math.max(12, Math.min(open.x - 170, document.documentElement.clientWidth - 352)),
              maxHeight: Math.min(520, open.room),
              translate: open.above ? '0 -100%' : undefined,
            }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            onPointerEnter={() => clearTimeout(closeTimer.current)}
            onPointerLeave={hideSoon}
          >
            <div className="pop-head mono">
              {d.label} · {a.label}
            </div>
            {list.length > 0 ? (
              <>
                <ul className="pop-list">
                  {list.map((x) => {
                    const site = siteUrl(x);
                    return (
                      <li key={x.id}>
                        {site ? (
                          <a className="pop-name" href={site} target="_blank" rel="noopener noreferrer" title="פתיחת האפליקציה">
                            {x.name}
                          </a>
                        ) : (
                          <button className="pop-name" onClick={() => go({ app: x.id })}>
                            {x.name}
                          </button>
                        )}
                        <button className="pop-sheet mono" onClick={() => go({ app: x.id })} title="דף האפליקציה בתיק">
                          {sheets.get(x.id)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="pop-foot">
                  <button className="link" onClick={() => go({ domain: open.domain, action: open.action, app: null })}>
                    סינון התיק למשבצת
                  </button>
                  <button className="link" onClick={() => onAdd({ action: open.action, domain: open.domain })}>
                    הוספת אפליקציה כאן
                  </button>
                </div>
              </>
            ) : (
              <div className="pop-idea">
                <p className="mono dim">משבצת ריקה. הצעה לאפליקציה שתמלא אותה:</p>
                <h4>{idea?.title ?? `${a.label} ב${d.label}`}</h4>
                <p>{idea?.idea ?? 'עדיין אין הצעה למשבצת הזו.'}</p>
                <div className="pop-actions">
                  <button className="solid" onClick={() => onAdd({ name: idea?.title, desc: idea?.idea, action: open.action, domain: open.domain })}>
                    הוספה לתיק מהרעיון
                  </button>
                  <button
                    className="ghost"
                    onClick={async () => {
                      const text = buildPrompt(idea?.title ?? '', idea?.idea ?? '', a.label, d.label, near);
                      try {
                        await navigator.clipboard.writeText(text);
                        toast('הפרומפט ל-Claude Code הועתק');
                      } catch {
                        toast('לא ניתן להעתיק בדפדפן הזה', 'error');
                      }
                    }}
                  >
                    העתקת פרומפט ל-Claude Code
                  </button>
                </div>
                {near.length > 0 && (
                  <div className="pop-near">
                    <span className="mono dim">אפשר להישען על</span>
                    <ul className="pop-list">
                      {near.map((x) => (
                        <li key={x.id}>
                          <button className="pop-name" onClick={() => go({ app: x.id })}>
                            {x.name}
                          </button>
                          <span className="mono dim">{actionOf(x.action)?.short}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
