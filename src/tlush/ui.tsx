import { Fragment, type ReactNode } from 'react';

/** Text standard: `**word**` becomes a marker. */
export function M({ children }: { children: string }) {
  const parts = children.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}</>;
}

/** Insight line (up to 8 words) + one explanation sentence. */
export function Insight({ title, children, tone }: { title: string; children?: string; tone?: 'red' | 'green' | 'amber' | 'blue' }) {
  return (
    <div className={`insight ${tone ?? ''}`}>
      <div className="insight-title"><M>{title}</M></div>
      {children && <p><M>{children}</M></p>}
    </div>
  );
}

export function Kpi({ label, value, note, tone, est }: { label: string; value: string; note?: string; tone?: string; est?: boolean }) {
  return (
    <div className={`kpi ${tone ?? ''} ${est ? 'is-est' : ''}`}>
      <div className="kpi-label">{label}{est && <Est />}</div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

export function Section({ n, id, title, lead, children }: { n?: string; id?: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="sec" id={id}>
      <header className="sec-head">
        {n && <span className="sec-n">{n}</span>}
        <h2>{title}</h2>
        {lead && <p className="sec-lead"><M>{lead}</M></p>}
      </header>
      {children}
    </section>
  );
}

export function NumField({ label, value, onChange, step = 1, suffix, help }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; help?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-row">
        <input type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

/** Horizontal stacked bar with a legend; values in shekels. */
export function Stack({ parts, total }: { parts: { label: string; value: number; tone: string }[]; total?: number }) {
  const t = total ?? parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  return (
    <div className="stack">
      <div className="stack-bar" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.value)}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} className={`seg ${p.tone}`} style={{ width: `${(p.value / t) * 100}%` }} title={`${p.label}: ${Math.round(p.value).toLocaleString('he-IL')} ₪`} />
        ))}
      </div>
      <ul className="legend">
        {parts.map((p) => (
          <li key={p.label}><span className={`dot ${p.tone}`} />{p.label}<b>{Math.round(p.value).toLocaleString('he-IL')} ₪</b><i>{t ? Math.round((p.value / t) * 100) : 0}%</i></li>
        ))}
      </ul>
    </div>
  );
}

/** "הערכה": an estimate is always marked, never shown like a fact (MOKED106: real vs demo data). */
export function Est() {
  return <span className="tag est">הערכה</span>;
}

/** Where a number comes from, under every section. */
export function Source({ children }: { children: string }) {
  return <p className="source"><b>מקור:</b> {children}</p>;
}

/** A value against its benchmark: the gold tick is the target, below it the bar turns red. */
export function Meter({ label, value, target, max, fmt, lowerIsBetter, note }: { label: string; value: number; target: number; max: number; fmt: (n: number) => string; lowerIsBetter?: boolean; note?: string }) {
  const bad = lowerIsBetter ? value > target : value < target;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  return (
    <div className={`meter-row ${bad ? 'below' : ''}`}>
      <div className="meter-top"><span>{label}</span><b>{fmt(value)}</b></div>
      <div className="meter" role="img" aria-label={`${label}: ${fmt(value)}, יעד ${fmt(target)}`}>
        <i style={{ width: pct(value) }} /><em style={{ insetInlineStart: pct(target) }} />
      </div>
      <div className="meter-note">{`יעד ${fmt(target)}${note ? `. ${note}` : ''}`}</div>
    </div>
  );
}

/** Small 12-month line, as in the MOKED106 topic table. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="spark-none">—</span>;
  const w = 90, h = 26, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} /><circle cx={w} cy={pts.split(' ').pop()!.split(',')[1]} r="2.5" /></svg>;
}

/** Sticky index of the page's sections. */
export function Toc({ items }: { items: [string, string][] }) {
  return (
    <nav className="toc" aria-label="חלקי הדף">
      {items.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a>)}
    </nav>
  );
}
