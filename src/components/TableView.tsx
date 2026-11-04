import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AppData, Facet } from '../lib/types';
import { actionOf, facetLabel } from '../lib/facets';
import { createdOf, fmtDate, platformOf, projectName, siteUrl, thumbOf } from '../lib/format';
import { copyShare, shareUrl } from '../lib/share';

type Col = 'sheet' | 'name' | 'purpose' | 'platform' | 'action' | 'domains' | 'contexts' | 'supabase' | 'github' | 'hasApi' | 'created' | 'updated';

const LABEL: Record<Col, string> = {
  sheet: 'גיליון',
  name: 'שם',
  updated: 'עודכן',
  purpose: 'מטרה',
  platform: 'פלטפורמה',
  action: 'פעולה',
  domains: 'תחום',
  contexts: 'הקשר',
  supabase: 'מסד נתונים',
  github: 'קוד',
  hasApi: 'ממשק',
  created: 'נוצר',
};

// Sorting a column groups the rows; each group gets a colour on that column only, with a legend (Anat, 2026-10-27).
// Dates group by calendar day (Anat, 2026-11-04: "תאריכים שונים באותו צבע"): one colour per day, never two days alike side by side.
const PALETTE = ['#3b6fb6', '#c8553d', '#2f8a57', '#b58900', '#7a4fa3', '#1b998b', '#d1495b', '#5c6b73', '#8d6a9f', '#e07a1f', '#4f772d', '#9c6644'];
const DAY = 86_400_000;
function relative(t: number): string {
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / DAY);
  if (d <= 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 30) return `לפני ${d} ימים`;
  const m = Math.round(d / 30);
  return m < 12 ? `לפני ${m === 1 ? 'חודש' : `${m} חודשים`}` : `לפני ${Math.round(d / 365) === 1 ? 'שנה' : `${Math.round(d / 365)} שנים`}`;
}
/** A new name. The page title follows when it was the same as the name, and the first old name stays searchable. */
const renamed = (a: AppData, name: string): AppData => ({
  ...a,
  name,
  title: !a.title || a.title.trim() === a.name.trim() ? name : a.title,
  originalName: a.originalName || a.name,
});
const time = (v?: string) => (v ? new Date(v).getTime() || 0 : 0);

// Platforms as their own icons (Anat, 2026-11-04), the name stays in the tooltip and for screen readers.
const ICON_DOMAIN: Record<string, string> = {
  Vercel: 'vercel.com',
  Lovable: 'lovable.dev',
  Base44: 'base44.com',
  'GitHub Pages': 'github.com',
  Netlify: 'netlify.com',
  Gemini: 'gemini.google.com',
  Canva: 'canva.com',
  Claude: 'claude.ai',
};
const icon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

interface Props {
  apps: AppData[];
  facets: Facet[];
  sheets: Map<string, string>;
  onOpen: (id: string) => void;
  onChange: (a: AppData) => void;
}

const short = (url: string, kind: 'github' | 'supabase') =>
  kind === 'github' ? url.replace(/^https?:\/\/github\.com\/[^/]+\//, '').replace(/\/$/, '') : url.match(/\/project\/([^/?#]+)/)?.[1] ?? url;

/** Sort arrows drawn as shapes: both faint on every column, one solid on the column the table is sorted by. */
function Arrows({ dir }: { dir: 0 | 1 | -1 }) {
  return (
    <svg className={`sort-arrows ${dir ? 'on' : ''}`} viewBox="0 0 10 14" width="10" height="14" aria-hidden>
      <path d="M5 1 L9 5.5 H1 Z" opacity={dir === 1 ? 1 : dir === -1 ? 0.18 : 0.35} />
      <path d="M5 13 L9 8.5 H1 Z" opacity={dir === -1 ? 1 : dir === 1 ? 0.18 : 0.35} />
    </svg>
  );
}

/**
 * The table edits while it shows (Anat, 2026-11-04: "אני רוצה לערוך תוך כדי תצוגה ושישמר בזמן אמת"): no edit mode. Every
 * text cell is a field that looks like text; Enter or leaving it saves online at once, and the cell flashes green.
 */
export default function TableView({ apps, facets, sheets, onOpen, onChange }: Props) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'updated', dir: -1 });
  const [filter, setFilter] = useState<{ col: Col; value: string } | null>(null);
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState('');
  const orderRef = useRef<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const save = (a: AppData, key: string) => {
    onChange(a);
    setFlash(key);
    setTimeout(() => setFlash((f) => (f === key ? '' : f)), 1400);
  };

  const rows = useMemo(() => {
    let list = apps.map((a) => ({
      app: a,
      sheet: sheets.get(a.id) ?? '',
      name: a.name,
      project: projectName(a.previewUrl),
      purpose: a.purpose ?? '',
      platform: platformOf(a.previewUrl),
      action: actionOf(a.action)?.short ?? '',
      domains: (a.domains ?? []).map((d) => facetLabel(facets, 'domain', d)),
      contexts: (a.contexts ?? []).map((c) => facetLabel(facets, 'context', c)),
      supabase: a.supabaseProjectUrl ?? '',
      github: a.githubUrl ?? '',
      hasApi: a.hasApi === true ? 'כן' : a.hasApi === false ? 'לא' : '',
      created: createdOf(a),
      updated: time(a.updatedAt) || createdOf(a),
    }));
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((r) => [r.name, r.app.originalName, r.project, r.purpose, r.platform, r.action, ...r.domains, ...r.contexts, ...(r.app.keywords ?? []), r.github, r.supabase].join(' ').toLowerCase().includes(t));
    if (filter) list = list.filter((r) => { const v = r[filter.col]; return Array.isArray(v) ? v.includes(filter.value) : String(v) === filter.value; });
    // A row being edited stays where it is: the order is set again only when the sort, the filter or the app count changes,
    // so a save (which updates the date) never makes the row jump to the top under the cursor.
    const key = JSON.stringify([sort, filter, t, apps.length]);
    const prev = orderRef.current;
    if (prev.key === key && prev.ids.length === list.length) {
      const at = new Map(prev.ids.map((id, i) => [id, i]));
      if (list.every((r) => at.has(r.app.id))) return list.sort((a, b) => at.get(a.app.id)! - at.get(b.app.id)!);
    }
    list.sort((a, b) => {
      const x = Array.isArray(a[sort.col]) ? (a[sort.col] as string[]).join(' ') : a[sort.col];
      const y = Array.isArray(b[sort.col]) ? (b[sort.col] as string[]).join(' ') : b[sort.col];
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'he');
      return c * sort.dir;
    });
    orderRef.current = { key, ids: list.map((r) => r.app.id) };
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, sheets, facets, sort, filter, q]);

  // The group of a row for the sorted column: dates by day, yes/no columns by presence, labels by value.
  const groupOf = (r: (typeof rows)[number]): string => {
    switch (sort.col) {
      case 'updated':
      case 'created':
        return r[sort.col] ? fmtDate(r[sort.col]) : 'ללא תאריך';
      case 'sheet':
        return '';
      case 'name':
        return r.name.trim().slice(0, 1) || '';
      case 'purpose':
      case 'supabase':
      case 'github':
        return r[sort.col] ? 'יש' : 'חסר';
      case 'domains':
      case 'contexts':
        return r[sort.col][0] ?? 'ללא';
      default:
        return String(r[sort.col] || 'ללא');
    }
  };
  const groups = useMemo(() => {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      const g = groupOf(r);
      if (!g) continue;
      if (!counts.has(g)) order.push(g);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const color = new Map(order.map((g, i) => [g, PALETTE[i % PALETTE.length]]));
    return { order, counts, color };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.col]);
  const tint = (col: Col, r: (typeof rows)[number]) => {
    if (sort.col !== col) return undefined;
    const c = groups.color.get(groupOf(r));
    return c ? ({ '--g': c } as React.CSSProperties) : undefined;
  };
  const cls = (col: Col, extra = '') => [extra, sort.col === col ? 'sorted' : '', sort.col === col && groups.order.length > 0 ? 'grouped' : ''].filter(Boolean).join(' ');

  const th = (col: Col) => (
    <th className={sort.col === col ? 'sorted' : ''} aria-sort={sort.col === col ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ col, dir: s.col === col ? (s.dir === 1 ? -1 : 1) : col === 'updated' || col === 'created' ? -1 : 1 }))} title={`מיון לפי ${LABEL[col]}`}>
        <span>{LABEL[col]}</span>
        <Arrows dir={sort.col === col ? sort.dir : 0} />
      </button>
    </th>
  );
  const tag = (col: Col, value: string, children?: React.ReactNode) =>
    value ? (
      <button className={`tag ${filter?.col === col && filter.value === value ? 'on' : ''}`} onClick={() => setFilter((f) => (f?.col === col && f.value === value ? null : { col, value }))} title={`סינון: ${value}`}>
        {children ?? value}
      </button>
    ) : (
      <span className="dim">—</span>
    );

  /** A field that looks like text. Enter or leaving it saves; Escape puts the old value back. */
  const field = (a: AppData, key: 'name' | 'purpose' | 'githubUrl' | 'supabaseProjectUrl', value: string, opts: { ltr?: boolean; placeholder?: string; label: string; show?: (v: string) => string }) => (
    <input
      key={a.id + key + value}
      className={`cell-field ${key === 'name' ? 'name-field' : ''}`}
      dir={opts.ltr ? 'ltr' : undefined}
      defaultValue={opts.show && value ? opts.show(value) : value}
      placeholder={opts.placeholder ?? ''}
      onFocus={(e) => {
        if (opts.show) e.currentTarget.value = value;
      }}
      aria-label={`${opts.label}: ${a.name}`}
      title={value || opts.placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v === value.trim()) {
          if (opts.show && value) e.target.value = opts.show(value);
          return;
        }
        if (key === 'name') {
          if (!v) {
            e.target.value = value;
            return;
          }
          save(renamed(a, v), a.id + key);
        } else save({ ...a, [key]: v }, a.id + key);
      }}
    />
  );
  const linkCell = (a: AppData, key: 'githubUrl' | 'supabaseProjectUrl', value: string, kind: 'github' | 'supabase') => (
    <div className="link-cell">
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" title={`${kind === 'github' ? 'קוד' : 'מסד נתונים'}: ${short(value, kind)}`}>
          <img src={icon(kind === 'github' ? 'github.com' : 'supabase.com')} alt={kind === 'github' ? 'קוד' : 'מסד נתונים'} width={18} height={18} loading="lazy" />
        </a>
      )}
      {field(a, key, value, { ltr: true, placeholder: '+', show: (v) => short(v, kind), label: kind === 'github' ? 'קישור לקוד' : 'קישור למסד הנתונים' })}
    </div>
  );

  const count = (k: 'github' | 'supabase') => rows.filter((r) => r[k]).length;
  const MAX_LEGEND = 16;

  return (
    <motion.div className="table-view" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <header className="band-head">
        <span className="mono">T</span>
        <h2>טבלת אפליקציות</h2>
        <span className="band-note">
          {rows.length} מתוך {apps.length} · עם קוד {count('github')} · עם מסד נתונים {count('supabase')} · עם ממשק {rows.filter((r) => r.hasApi === 'כן').length}
        </span>
        <span className="band-note table-hint">כל תא נערך במקום: לוחצים, כותבים, Enter. השמירה מיידית.</span>
        <div className="filters">
          <input className="table-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="סינון בטבלה" aria-label="סינון בטבלה" />
          {filter && (
            <button className="chip on" onClick={() => setFilter(null)}>
              {filter.value} · הסרה
            </button>
          )}
        </div>
      </header>
      {groups.order.length > 0 && (
        <div className="legend" aria-label="מקרא">
          <span className="mono dim">מקרא · {LABEL[sort.col]}</span>
          {groups.order.slice(0, MAX_LEGEND).map((g) => (
            <span key={g} className="legend-item" style={{ '--g': groups.color.get(g) } as React.CSSProperties}>
              <i />
              {g}
              <span className="mono dim">{groups.counts.get(g)}</span>
            </span>
          ))}
          {groups.order.length > MAX_LEGEND && <span className="dim">ועוד {groups.order.length - MAX_LEGEND}</span>}
        </div>
      )}
      <div className="table-wrap">
        <table className="apps-table">
          <colgroup>
            <col style={{ width: 64 }} />
            <col style={{ width: 230 }} />
            <col style={{ width: 104 }} />
            <col />
            <col style={{ width: 80 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 124 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 66 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 62 }} />
          </colgroup>
          <thead>
            <tr>
              {th('sheet')}
              {th('name')}
              {th('updated')}
              {th('purpose')}
              {th('platform')}
              {th('action')}
              {th('domains')}
              {th('contexts')}
              {th('supabase')}
              {th('github')}
              {th('hasApi')}
              {th('created')}
              <th className="plain">שיתוף</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const site = siteUrl(r.app);
              const thumb = thumbOf(r.app);
              const f = (k: string) => (flash === r.app.id + k ? 'flash' : '');
              return (
                <tr key={r.app.id}>
                  <td className={cls('sheet', 'mono')} style={tint('sheet', r)}>
                    <button className="link mono" onClick={() => onOpen(r.app.id)} title="דף האפליקציה בתיק">
                      {r.sheet}
                    </button>
                  </td>
                  <td className={cls('name', `name-cell ${f('name')}`)} style={tint('name', r)}>
                    {site ? (
                      <a className="row-thumb" href={site} target="_blank" rel="noopener noreferrer" title={`פתיחת האפליקציה: ${site}`}>
                        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span>{r.name.slice(0, 1)}</span>}
                      </a>
                    ) : (
                      <span className="row-thumb no-site">{thumb ? <img src={thumb} alt="" loading="lazy" /> : r.name.slice(0, 1)}</span>
                    )}
                    <div className="name-stack">
                      {field(r.app, 'name', r.name, { label: 'שם' })}
                      {r.project && <span className="mono dim" dir="ltr">{r.project}</span>}
                    </div>
                  </td>
                  <td className={cls('updated', 'updated')} style={tint('updated', r)}>
                    <b className="mono">{fmtDate(r.updated)}</b>
                    <span>{relative(r.updated)}</span>
                  </td>
                  <td className={cls('purpose', f('purpose'))} style={tint('purpose', r)}>
                    {field(r.app, 'purpose', r.purpose, { placeholder: 'מטרה', label: 'מטרה' })}
                  </td>
                  <td className={cls('platform', 'center')} style={tint('platform', r)}>
                    {r.platform
                      ? tag(
                          'platform',
                          r.platform,
                          ICON_DOMAIN[r.platform] ? <img className="plat" src={icon(ICON_DOMAIN[r.platform])} alt={r.platform} title={r.platform} width={20} height={20} loading="lazy" /> : r.platform,
                        )
                      : tag('platform', '')}
                  </td>
                  <td className={cls('action')} style={tint('action', r)}>{tag('action', r.action)}</td>
                  <td className={cls('domains', 'tags')} style={tint('domains', r)}>{r.domains.length ? r.domains.map((d) => <span key={d}>{tag('domains', d)}</span>) : <span className="dim">—</span>}</td>
                  <td className={cls('contexts', 'tags')} style={tint('contexts', r)}>{r.contexts.length ? r.contexts.map((c) => <span key={c}>{tag('contexts', c)}</span>) : <span className="dim">—</span>}</td>
                  <td className={cls('supabase', f('supabaseProjectUrl'))} style={tint('supabase', r)}>{linkCell(r.app, 'supabaseProjectUrl', r.supabase, 'supabase')}</td>
                  <td className={cls('github', f('githubUrl'))} style={tint('github', r)}>{linkCell(r.app, 'githubUrl', r.github, 'github')}</td>
                  <td className={cls('hasApi', f('hasApi'))} style={tint('hasApi', r)}>
                    <select
                      className="cell-field"
                      value={r.hasApi === 'כן' ? 'true' : r.hasApi === 'לא' ? 'false' : ''}
                      onChange={(e) => save({ ...r.app, hasApi: e.target.value === '' ? undefined : e.target.value === 'true' }, r.app.id + 'hasApi')}
                      aria-label={`ממשק: ${r.name}`}
                    >
                      <option value="">—</option>
                      <option value="true">כן</option>
                      <option value="false">לא</option>
                    </select>
                  </td>
                  <td className={cls('created', 'mono dim')} style={tint('created', r)}>{fmtDate(r.created, true)}</td>
                  <td className="center">
                    {site ? (
                      <button className="link" onClick={() => copyShare(r.app)} title={`העתקת קישור עם תמונה: ${shareUrl(r.app)}`}>
                        העתקה
                      </button>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
