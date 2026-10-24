import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { AppData, Category } from '../lib/types';
import { createdOf, fmtDate, platformOf, projectName, siteUrl } from '../lib/format';
import { toast } from './Toasts';

type Col = 'sheet' | 'name' | 'project' | 'purpose' | 'platform' | 'category' | 'supabase' | 'github' | 'hasApi' | 'created';

interface Props {
  apps: AppData[];
  categories: Category[];
  sheets: Map<string, string>;
  editing: boolean;
  onOpen: (id: string) => void;
  onChange: (a: AppData) => void;
}

const short = (url: string, kind: 'github' | 'supabase') =>
  kind === 'github' ? url.replace(/^https?:\/\/github\.com\//, '') : url.match(/\/project\/([^/?#]+)/)?.[1] ?? url;

export default function TableView({ apps, categories, sheets, editing, onOpen, onChange }: Props) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'sheet', dir: 1 });
  const [filter, setFilter] = useState<{ col: Col; value: string } | null>(null);
  const [q, setQ] = useState('');
  const label = (v?: string | null) => categories.find((c) => c.value === v)?.label ?? '';

  const rows = useMemo(() => {
    let list = apps.map((a) => ({
      app: a,
      sheet: sheets.get(a.id) ?? '',
      name: a.name,
      project: projectName(a.previewUrl),
      purpose: a.purpose ?? '',
      platform: platformOf(a.previewUrl),
      category: label(a.category),
      supabase: a.supabaseProjectUrl ?? '',
      github: a.githubUrl ?? '',
      hasApi: a.hasApi === true ? 'כן' : a.hasApi === false ? 'לא' : '',
      created: createdOf(a),
    }));
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((r) => [r.name, r.project, r.purpose, r.platform, r.category, r.github, r.supabase].join(' ').toLowerCase().includes(t));
    if (filter) list = list.filter((r) => String(r[filter.col]) === filter.value);
    return list.sort((a, b) => {
      const x = a[sort.col];
      const y = b[sort.col];
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'he');
      return c * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, sheets, categories, sort, filter, q]);

  const th = (col: Col, text: string) => (
    <th>
      <button className={sort.col === col ? 'on' : ''} onClick={() => setSort((s) => ({ col, dir: s.col === col ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {text}
        <span className="mono dim">{sort.col === col ? (sort.dir === 1 ? ' א-ת' : ' ת-א') : ''}</span>
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {th('sheet', 'גיליון')}
              {th('name', 'שם')}
              {th('project', 'פרויקט')}
              {th('purpose', 'מטרה')}
              {th('platform', 'פלטפורמה')}
              {th('category', 'קטגוריה')}
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
                  <td className="mono dim">{r.sheet}</td>
                  <td>
                    <button className="link strong" onClick={() => onOpen(r.app.id)}>
                      {r.name}
                    </button>
                  </td>
                  <td className="mono">{r.project ? (site ? <a href={site} target="_blank" rel="noopener noreferrer" dir="ltr">{r.project}</a> : r.project) : <span className="dim">—</span>}</td>
                  <td className="wide">{cell(r.app, 'purpose', r.purpose)}</td>
                  <td>{tag('platform', r.platform)}</td>
                  <td>{tag('category', r.category)}</td>
                  <td>{cell(r.app, 'supabaseProjectUrl', r.supabase, 'supabase')}</td>
                  <td>{cell(r.app, 'githubUrl', r.github, 'github')}</td>
                  <td>
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
                  <td className="mono dim">{fmtDate(r.created)}</td>
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
