import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ActionValue, AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { ACTIONS, actionOf } from '../lib/facets';
import { siteUrl, thumbOf } from '../lib/format';
import { CELL_IDEAS } from '../data/ideas';
import IdeaList, { HowToBuild } from './IdeaList';
import AppCard from './AppCard';

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

/** A whole row (domain) or column (action) opened from its header. */
interface Line {
  kind: 'row' | 'col';
  value: string;
  x: number;
  y: number;
  above: boolean;
  room: number;
}

/** Domain against action. Every cell is a door; an empty cell is a gap with a suggested app. */
export default function Matrix({ apps, facets, sheets, go, onAdd }: Props) {
  const domains = facets.filter((f) => f.kind === 'domain');
  const cellApps = (d: string, a: ActionValue) => apps.filter((x) => x.action === a && x.domains?.includes(d));
  const max = Math.max(1, ...domains.flatMap((d) => ACTIONS.map((a) => cellApps(d.value, a.value).length)));
  const [open, setOpen] = useState<Open | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const pop = useRef<HTMLDivElement>(null);

  // Hover intent (Anat, 2026-10-28: "לפעמים הוא שולח אותי לאפליקציה אחרת"): on the way from a cell to its window the
  // pointer crosses other cells. The open window does not switch while the pointer is inside it, switches to another
  // cell only after the pointer rests there, and a window opened by a click stays until a click elsewhere.
  const switchTimer = useRef<ReturnType<typeof setTimeout>>();
  const inPop = useRef(false);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;
  const place = (domain: string, action: ActionValue, el: HTMLElement, pinned: boolean) => {
    const r = el.getBoundingClientRect();
    const below = innerHeight - r.bottom - 16;
    const above = below < 320 && r.top > below;
    setOpen({ domain, action, x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above, room: Math.max(160, (above ? r.top : below) - 16), pinned });
  };
  const show = (domain: string, action: ActionValue, el: HTMLElement, pinned = false) => {
    clearTimeout(closeTimer.current);
    clearTimeout(switchTimer.current);
    const cur = openRef.current;
    if (pinned || !cur) return place(domain, action, el, pinned);
    if (cur.domain === domain && cur.action === action) return;
    if (cur.pinned || inPop.current) return;
    switchTimer.current = setTimeout(() => {
      if (!inPop.current && !openRef.current?.pinned) place(domain, action, el, false);
    }, 280);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    clearTimeout(switchTimer.current);
    closeTimer.current = setTimeout(() => setOpen((o) => (o?.pinned || inPop.current ? o : null)), 220);
  };

  useEffect(() => {
    if (!open) inPop.current = false;
  }, [open]);

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
  // Ideas for every cell, filled or empty (Anat, 2026-11-04). An idea that has since been built is left out.
  const names = new Set(apps.map((x) => x.name.trim()));
  const ideas = open ? (CELL_IDEAS[`${open.domain}:${open.action}`] ?? []).filter((i) => !names.has(i.title.trim())) : [];
  // Raw material for a gap: apps in the same row (domain) and the same column (action).
  const near = open && !list.length
    ? [...apps.filter((x) => x.domains?.includes(open.domain)).slice(0, 2), ...apps.filter((x) => x.action === open.action).slice(0, 2)]
        .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
    : [];

  // A header opens the links of its whole line on the same page (Anat, 2026-11-05: "לחיצה על עמודה או שורה ... צריכה לפתוח
  // את הקישורים של האפליקציות שבאותה שורה או עמודה באותו הדף"). The same click still sorts the map by that line.
  const [line, setLine] = useState<Line | null>(null);
  const linePop = useRef<HTMLDivElement>(null);
  const openLine = (kind: Line['kind'], value: string, el: HTMLElement) => {
    setOpen(null);
    if (line?.kind === kind && line.value === value) return setLine(null);
    const r = el.getBoundingClientRect();
    const below = innerHeight - r.bottom - 16;
    const above = below < 320 && r.top > below;
    setLine({ kind, value, x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above, room: Math.max(200, (above ? r.top : below) - 16) });
  };
  useEffect(() => {
    if (!line) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setLine(null);
      line.kind === 'col' ? setRowBy(null) : setColBy(null);
    };
    const out = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (linePop.current && !linePop.current.contains(t) && !t.closest('.matrix .axis')) setLine(null);
    };
    const y0 = scrollY;
    const scroll = () => Math.abs(scrollY - y0) > 60 && setLine(null);
    addEventListener('keydown', k);
    addEventListener('pointerdown', out);
    addEventListener('scroll', scroll, { passive: true });
    return () => {
      removeEventListener('keydown', k);
      removeEventListener('pointerdown', out);
      removeEventListener('scroll', scroll);
    };
  }, [line]);

  // Sorting stays inside the map (Anat, 2026-11-04: "מיון לפי שורה או עמודה - בתוך העמוד שלה"): a column header orders the
  // rows by how many apps they have in that column, a row header orders the columns; a second click restores the order.
  const [rowBy, setRowBy] = useState<ActionValue | null>(null);
  const [colBy, setColBy] = useState<string | null>(null);
  const rows = rowBy ? [...domains].sort((x, y) => cellApps(y.value, rowBy).length - cellApps(x.value, rowBy).length) : domains;
  const cols = colBy ? [...ACTIONS].sort((x, y) => cellApps(colBy, y.value).length - cellApps(colBy, x.value).length) : ACTIONS;

  // A click on a filled cell opens all of its apps under the map, on the same page (Anat, 2026-11-09). Hover still shows
  // the small window; a second click on the same cell closes the list.
  const [picked, setPicked] = useState<{ domain: string; action: ActionValue } | null>(null);
  const below = useRef<HTMLElement>(null);
  const pick = (domain: string, action: ActionValue) => {
    clearTimeout(switchTimer.current);
    setOpen(null);
    setLine(null);
    setPicked((p) => (p?.domain === domain && p.action === action ? null : { domain, action }));
  };
  useEffect(() => {
    if (picked) below.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);
  const pd = picked && domains.find((f) => f.value === picked.domain);
  const pa = picked && actionOf(picked.action);
  const pickedApps = picked ? cellApps(picked.domain, picked.action) : [];

  return (
    <>
    <div className="matrix-wrap">
      <table className="matrix" style={{ '--rows': domains.length } as React.CSSProperties}>
        <thead>
          <tr>
            <th className="corner mono">תחום / פעולה</th>
            {cols.map((ac) => (
              <th key={ac.value} scope="col" className={rowBy === ac.value ? 'sorted' : ''}>
                <button className="axis" aria-pressed={rowBy === ac.value} onClick={(e) => {
                    setRowBy((v) => (v === ac.value ? null : ac.value));
                    openLine('col', ac.value, e.currentTarget);
                  }} title={`${ac.question}. לחיצה פותחת את כל האפליקציות בעמודה וממיינת לפיה`}>
                  {ac.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((dm, i) => (
            <tr key={dm.value}>
              <th scope="row" className={colBy === dm.value ? 'sorted' : ''}>
                <button className="axis" aria-pressed={colBy === dm.value} onClick={(e) => {
                    setColBy((v) => (v === dm.value ? null : dm.value));
                    openLine('row', dm.value, e.currentTarget);
                  }} title="לחיצה פותחת את כל האפליקציות בשורה וממיינת לפיה">
                  {dm.label}
                </button>
              </th>
              {cols.map((ac) => {
                const cell = cellApps(dm.value, ac.value);
                const n = cell.length;
                const isOpen = open?.domain === dm.value && open.action === ac.value;
                const isPicked = picked?.domain === dm.value && picked.action === ac.value;
                return (
                  <td key={ac.value}>
                    {n ? (
                      <motion.button
                        className={`cell ${isOpen ? 'on' : ''} ${isPicked ? 'picked' : ''}`}
                        style={{ ['--d' as string]: n / max }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.03 }}
                        onPointerEnter={(e) => e.pointerType === 'mouse' && show(dm.value, ac.value, e.currentTarget)}
                        onPointerLeave={hideSoon}
                        onFocus={(e) => show(dm.value, ac.value, e.currentTarget)}
                        onClick={() => pick(dm.value, ac.value)}
                        aria-expanded={isPicked}
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
              left: Math.max(12, Math.min(open.x - 200, document.documentElement.clientWidth - 432)),
              maxHeight: Math.min(620, open.room),
              translate: open.above ? '0 -100%' : undefined,
            }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, pointerEvents: 'none' }}
            transition={{ duration: 0.16 }}
            onPointerEnter={() => {
              inPop.current = true;
              clearTimeout(closeTimer.current);
              clearTimeout(switchTimer.current);
            }}
            onPointerLeave={() => {
              inPop.current = false;
              hideSoon();
            }}
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
              <p className="mono dim pop-empty">משבצת ריקה: עוד אין כאן אפליקציה.</p>
            )}
            {ideas.length > 0 && (
              <div className="pop-ideas">
                <div className="pop-ideas-head mono">{list.length ? 'רעיונות להמשך במשבצת' : 'רעיונות שימלאו אותה'}</div>
                <IdeaList ideas={ideas} apps={apps} near={near} actionLabel={a.label} domainLabel={d.label} prefill={{ action: open.action, domain: open.domain }} go={go} onAdd={onAdd} />
                <HowToBuild />
              </div>
            )}
            {!list.length && near.length > 0 && (
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {line && (() => {
          const isRow = line.kind === 'row';
          const label = isRow ? domains.find((x) => x.value === line.value)?.label : actionOf(line.value as ActionValue)?.label;
          const groups = (isRow ? cols.map((ac) => ({ key: ac.value, label: ac.label, list: cellApps(line.value, ac.value) }))
            : rows.map((dm) => ({ key: dm.value, label: dm.label, list: cellApps(dm.value, line.value as ActionValue) }))).filter((g) => g.list.length);
          const total = new Set(groups.flatMap((g) => g.list.map((x) => x.id))).size;
          return (
            <motion.div
              ref={linePop}
              key={`${line.kind}:${line.value}`}
              className="cell-pop line-pop"
              role="dialog"
              aria-label={`${isRow ? 'שורה' : 'עמודה'}: ${label}`}
              style={{
                top: line.y,
                left: Math.max(12, Math.min(line.x - 210, document.documentElement.clientWidth - 476)),
                maxHeight: Math.min(680, line.room),
                translate: line.above ? '0 -100%' : undefined,
              }}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, pointerEvents: 'none' }}
              transition={{ duration: 0.16 }}
            >
              <div className="pop-head line-head">
                <span className="mono dim">{isRow ? 'שורה' : 'עמודה'}</span>
                <strong>{label}</strong>
                <span className="mono">{total} אפליקציות</span>
                <button className="line-x" onClick={() => setLine(null)} aria-label="סגירה">
                  סגירה
                </button>
              </div>
              {groups.length ? (
                groups.map((g) => (
                  <section key={g.key} className="line-group">
                    <div className="line-group-head mono">
                      {g.label} <span className="dim">{g.list.length}</span>
                    </div>
                    <ul className="pop-list">
                      {g.list.map((x) => {
                        const site = siteUrl(x);
                        return (
                          <li key={x.id}>
                            {site ? (
                              <a className="pop-name" href={site} target="_blank" rel="noopener noreferrer" title={site}>
                                {x.name}
                              </a>
                            ) : (
                              <button className="pop-name" onClick={() => go({ app: x.id })} title="אין קישור: דף האפליקציה בתיק">
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
                  </section>
                ))
              ) : (
                <p className="mono dim pop-empty">עוד אין אפליקציות ב{isRow ? 'שורה' : 'עמודה'} הזו.</p>
              )}
              <div className="pop-foot">
                <button className="link" onClick={() => go(isRow ? { domain: line.value, action: null, app: null } : { action: line.value as ActionValue, domain: null, app: null })}>
                  סינון התיק ל{isRow ? 'שורה' : 'עמודה'}
                </button>
                <button className="link" onClick={() => onAdd(isRow ? { domain: line.value } : { action: line.value as ActionValue })}>
                  הוספת אפליקציה כאן
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
    {picked && pd && pa && (
      <section className="cell-below" ref={below} aria-label={`${pd.label}, ${pa.label}`}>
        <header className="cell-below-head">
          <span className="mono dim">משבצת</span>
          <strong>
            {pd.label} · {pa.label}
          </strong>
          <span className="mono">{pickedApps.length} אפליקציות</span>
          <button className="link" onClick={() => go({ domain: picked.domain, action: picked.action, app: null })}>
            סינון התיק למשבצת
          </button>
          <button className="link" onClick={() => onAdd({ action: picked.action, domain: picked.domain })}>
            הוספת אפליקציה כאן
          </button>
          <button className="line-x" onClick={() => setPicked(null)}>
            סגירה
          </button>
        </header>
        <div className="recent">
          {pickedApps.map((x, i) => (
            <AppCard key={x.id} app={x} sheet={sheets.get(x.id) ?? ''} category={pd.label} onOpen={() => go({ app: x.id })} index={i} compact still />
          ))}
        </div>
      </section>
    )}
    </>
  );
}
