import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { AppData, Facet } from '../lib/types';
import { actionOf, facetLabel } from '../lib/facets';
import { createdOf, fmtDate, platformOf, projectName, siteUrl } from '../lib/format';
import { toast } from './Toasts';

type Col = 'sheet' | 'name' | 'project' | 'purpose' | 'platform' | 'action' | 'domains' | 'contexts' | 'supabase' | 'github' | 'hasApi' | 'created' | 'updated';

// Sorting a column groups the rows; each group gets a colour on that column only, with a legend (Anat, 2026-10-27).
const PALETTE = ['#3b6fb6', '#c8553d', '#2f8a57', '#b58900', '#7a4fa3', '#1b998b', '#d1495b', '#5c6b73', '#8d6a9f', '#e07a1f', '#4f772d', '#9c6644'];
const DAY = 86_400_000;
function age(t: number): string {
  if (!t) return 'ללא תאריך';
  const d = (Date.now() - t) / DAY;
  if (d < 1) return 'היום';
  if (d < 7) return 'השבוע';
  if (d < 31) return 'החודש';
  if (d < 92) return 'שלושה חודשים';
  if (d < 365) return 'השנה';
  return 'לפני יותר משנה';
}
const AGE_ORDER = ['היום', 'השבוע', 'החודש', 'שלושה חודשים', 'השנה', 'לפני יותר משנה', 'ללא תאריך'];
function relative(t: number): string {
  if (!t) return '';
  const d = Math.floor((Date.now() - t) / DAY);
  if (d <= 0) return 'היום';
  if (d === 1) return 'אתמול';
  if (d < 30) return `לפני ${d} ימים`;
  const m = Math.round(d / 30);
  return m < 12 ? `לפני ${m === 1 ? 'חודש' : `${m} חודשים`}` : `לפני ${Math.round(d / 365) === 1 ? 'שנה' : `${Math.round(d / 365)} שנים`}`;
}
const time = (v?: string) => (v ? new Date(v).getTime() || 0 : 0);

interface Props {
  apps: AppData[];
  facets: Facet[];
  sheets: Map<string, string>;
  editing: boolean;
  onOpen: (id: string) => void;
  onChange: (a: AppData) => void;
}

const short = (url: string, kind: 'github' | 'supabase') =>
  kind === 'github' ? url.replace(/^https?:\/\/github\.com\//, '') : url.match(/\/project\/([^/?#]+)/)?.[1] ?? url;

export default function TableView({ apps, facets, sheets, editing, onOpen, onChange }: Props) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'updated', dir: -1 });
  const [filter, setFilter] = useState<{ col: Col; value: string } | null>(null);
  const [q, setQ] = useState('');

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
    return list.sort((a, b) => {
      const x = Array.isArray(a[sort.col]) ? (a[sort.col] as string[]).join(' ') : a[sort.col];
      const y = Array.isArray(b[sort.col]) ? (b[sort.col] as string[]).join(' ') : b[sort.col];
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'he');
      return c * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, sheets, facets, sort, filter, q]);

  // The group of a row for the sorted column: dates by age, yes/no columns by presence, labels by value.
  const groupOf = (r: (typeof rows)[number]): string => {
    switch (sort.col) {
      case 'updated':
      case 'created':
        return age(r[sort.col]);
      case 'sheet':
        return '';
      case 'name':
        return r.name.trim().slice(0, 1) || '';
      case 'project':
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
    if (sort.col === 'updated' || sort.col === 'created') order.sort((a, b) => AGE_ORDER.indexOf(a) - AGE_ORDER.indexOf(b) * 1);
    const color = new Map(order.map((g, i) => [g, PALETTE[i % PALETTE.length]]));
    return { order, counts, color };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.col]);
  const tint = (col: Col, r: (typeof rows)[number]) => {
    if (sort.col !== col) return undefined;
    const c = groups.color.get(groupOf(r));
    return c ? ({ '--g': c } as React.CSSProperties) : undefined;
  };
  const grouped = (col: Col) => (sort.col === col && groups.order.length > 0 ? 'grouped' : '');

  const th = (col: Col, text: string) => (
    <th>
      <button className={sort.col === col ? 'on' : ''} onClick={() => setSort((s) => ({ col, dir: s.col === col ? (s.dir === 1 ? -1 : 1) : col === 'updated' || col === 'created' ? -1 : 1 }))}>
        {text}
        <span className="mono dim">{sort.col === col ? (col === 'updated' || col === 'created' ? (sort.dir === 1 ? ' ישן-חדש' : ' חדש-ישן') : sort.dir === 1 ? ' א-ת' : ' ת-א') : ''}</span>
      </button>
    </th>
  );
  const tag = (col: Col, value: string) =>
    value ? (
      <button className={`tag ${filter?.col === col && filter.value === value ? 'on' : ''}`} onClick={() => setFilter((f) => (f?.col === col && f.value === value ? null : { col, value }))}>
        {value}
      </button>
    ) : (
      <span className="dim">—</span>
    );
  const cell = (a: AppData, key: 'purpose' | 'githubUrl' | 'supabaseProjectUrl', value: string, kind?: 'github' | 'supabase') =>
    editing ? (
      <input className="cell-input" dir={kind ? 'ltr' : undefined} defaultValue={value} onBlur={(e) => e.target.value.trim() !== value && onChange({ ...a, [key]: e.target.value.trim() })} aria-label={key} />
    ) : value ? (
      kind ? (
        <a className="mono" href={value} target="_blank" rel="noopener noreferrer" dir="ltr">
          {short(value, kind)}
        </a>
      ) : (
        <span className="clamp">{value}</span>
      )
    ) : (
      <span className="dim">—</span>
    );

  const count = (k: 'github' | 'supabase') => rows.filter((r) => r[k]).length;

  return (
    <motion.div className="table-view" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <header className="band-head">
        <span className="mono">T</span>
        <h2>טבלת אפליקציות</h2>
        <span className="band-note mono">
          {rows.length}/{apps.length} · GitHub {count('github')} · Supabase {count('supabase')} · API {rows.filter((r) => r.hasApi === 'כן').length}
        </span>
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
          <span className="mono dim">מקרא · {({ sheet: 'גיליון', name: 'שם', project: 'פרויקט', purpose: 'מטרה', platform: 'פלטפורמה', action: 'פעולה', domains: 'תחום', contexts: 'הקשר', supabase: 'Supabase', github: 'GitHub', hasApi: 'API', created: 'נוצר', updated: 'עודכן' } as Record<Col, string>)[sort.col]}</span>
          {groups.order.map((g) => (
            <span key={g} className="legend-item" style={{ '--g': groups.color.get(g) } as React.CSSProperties}>
              <i />
              {g}
              <span className="mono dim">{groups.counts.get(g)}</span>
            </span>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {th('sheet', 'גיליון')}
              {th('name', 'שם')}
              {th('updated', 'עודכן')}
              {th('project', 'פרויקט')}
              {th('purpose', 'מטרה')}
              {th('platform', 'פלטפורמה')}
              {th('action', 'פעולה')}
              {th('domains', 'תחום')}
              {th('contexts', 'הקשר')}
              {th('supabase', 'Supabase')}
              {th('github', 'GitHub')}
              {th('hasApi', 'API')}
              {th('created', 'נוצר')}
              <th>קישור</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const site = siteUrl(r.app);
              return (
                <tr key={r.app.id}>
                  <td className={`mono dim ${grouped('sheet')}`} style={tint('sheet', r)}>{r.sheet}</td>
                  <td className={grouped('name')} style={tint('name', r)}>
                    <button className="link strong" onClick={() => onOpen(r.app.id)}>
                      {r.name}
                    </button>
                  </td>
                  <td className={`updated ${grouped('updated')}`} style={tint('updated', r)}>
                    <b className="mono">{fmtDate(r.updated)}</b>
                    <span>{relative(r.updated)}</span>
                  </td>
                  <td className={`mono ${grouped('project')}`} style={tint('project', r)}>{r.project ? (site ? <a href={site} target="_blank" rel="noopener noreferrer" dir="ltr">{r.project}</a> : r.project) : <span className="dim">—</span>}</td>
                  <td className={`wide ${grouped('purpose')}`} style={tint('purpose', r)}>{cell(r.app, 'purpose', r.purpose)}</td>
                  <td className={grouped('platform')} style={tint('platform', r)}>{tag('platform', r.platform)}</td>
                  <td className={grouped('action')} style={tint('action', r)}>{tag('action', r.action)}</td>
                  <td className={`tags ${grouped('domains')}`} style={tint('domains', r)}>{r.domains.length ? r.domains.map((d) => <span key={d}>{tag('domains', d)}</span>) : <span className="dim">—</span>}</td>
                  <td className={`tags ${grouped('contexts')}`} style={tint('contexts', r)}>{r.contexts.length ? r.contexts.map((c) => <span key={c}>{tag('contexts', c)}</span>) : <span className="dim">—</span>}</td>
                  <td className={grouped('supabase')} style={tint('supabase', r)}>{cell(r.app, 'supabaseProjectUrl', r.supabase, 'supabase')}</td>
                  <td className={grouped('github')} style={tint('github', r)}>{cell(r.app, 'githubUrl', r.github, 'github')}</td>
                  <td className={grouped('hasApi')} style={tint('hasApi', r)}>
                    {editing ? (
                      <select
                        value={r.hasApi === 'כן' ? 'true' : r.hasApi === 'לא' ? 'false' : ''}
                        onChange={(e) => onChange({ ...r.app, hasApi: e.target.value === '' ? undefined : e.target.value === 'true' })}
                        aria-label="API"
                      >
                        <option value="">—</option>
                        <option value="true">כן</option>
                        <option value="false">לא</option>
                      </select>
                    ) : (
                      tag('hasApi', r.hasApi)
                    )}
                  </td>
                  <td className={`mono dim ${grouped('created')}`} style={tint('created', r)}>{fmtDate(r.created)}</td>
                  <td>
                    {site ? (
                      <button
                        className="link"
                        onClick={async () => {
                          await navigator.clipboard.writeText(site).catch(() => {});
                          toast('הקישור הועתק');
                        }}
                      >
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
