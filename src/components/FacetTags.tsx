import { useState } from 'react';
import type { AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { ACTIONS, actionOf, facetLabel } from '../lib/facets';

interface Props {
  app: AppData;
  facets: Facet[];
  editing: boolean;
  onChange: (a: AppData) => void;
  go: (p: Partial<Route>) => void;
}

/** The app's place on every axis. Each tag leads to the other apps that share it. */
export default function FacetTags({ app, facets, editing, onChange, go }: Props) {
  const [kw, setKw] = useState('');
  const toggle = (key: 'domains' | 'contexts', v: string) => {
    const cur = app[key] ?? [];
    onChange({ ...app, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const addKw = () => {
    const words = kw.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
    if (!words.length) return;
    onChange({ ...app, keywords: [...new Set([...(app.keywords ?? []), ...words])] });
    setKw('');
  };

  if (editing) {
    return (
      <section className="panel facet-edit">
        <header className="panel-head">
          <h3>סיווג</h3>
          <span className="dim">פעולה אחת: מה יוצאים איתו. תחומים והקשרים: כמה שצריך.</span>
        </header>
        <div className="facet-row">
          <div className="facet-title"><span className="mono">פעולה</span></div>
          <div className="facet-chips">
            {ACTIONS.map((a) => (
              <button key={a.value} className={`chip ${app.action === a.value ? 'on' : ''}`} onClick={() => onChange({ ...app, action: a.value })} title={a.question}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {(['domain', 'context'] as const).map((kind) => {
          const key = kind === 'domain' ? 'domains' : 'contexts';
          return (
            <div className="facet-row" key={kind}>
              <div className="facet-title"><span className="mono">{kind === 'domain' ? 'תחום' : 'הקשר'}</span></div>
              <div className="facet-chips">
                {facets.filter((f) => f.kind === kind).map((f) => (
                  <button key={f.value} className={`chip ${app[key]?.includes(f.value) ? 'on' : ''}`} onClick={() => toggle(key, f.value)} aria-pressed={!!app[key]?.includes(f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="facet-row">
          <div className="facet-title"><span className="mono">מילות מפתח</span></div>
          <div className="facet-chips">
            {(app.keywords ?? []).map((k) => (
              <button key={k} className="chip on" onClick={() => onChange({ ...app, keywords: (app.keywords ?? []).filter((x) => x !== k) })} title="הסרה">
                {k} · הסרה
              </button>
            ))}
            <span className="row kw-add">
              <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addKw()} placeholder="מילה, או כמה מופרדות בפסיק" aria-label="מילת מפתח חדשה" />
              <button className="ghost" onClick={addKw} disabled={!kw.trim()}>הוספה</button>
            </span>
          </div>
        </div>
        {app.originalName && app.originalName !== app.name && <p className="dim mono">שם קודם: {app.originalName}</p>}
      </section>
    );
  }

  const a = actionOf(app.action);
  return (
    <div className="facet-tags">
      {a && (
        <button className="tag strong" onClick={() => go({ action: a.value, domain: null, ctx: null, app: null, q: '' })} title={a.question}>
          {a.label}
        </button>
      )}
      {(app.domains ?? []).map((d) => (
        <button key={d} className="tag" onClick={() => go({ domain: d, action: null, ctx: null, app: null, q: '' })}>
          {facetLabel(facets, 'domain', d)}
        </button>
      ))}
      {(app.contexts ?? []).map((c) => (
        <button key={c} className="tag soft" onClick={() => go({ ctx: c, action: null, domain: null, app: null, q: '' })}>
          {facetLabel(facets, 'context', c)}
        </button>
      ))}
      {(app.keywords ?? []).map((k) => (
        <button key={k} className="tag kw" onClick={() => go({ q: k, action: null, domain: null, ctx: null, app: null })}>
          {k}
        </button>
      ))}
    </div>
  );
}
