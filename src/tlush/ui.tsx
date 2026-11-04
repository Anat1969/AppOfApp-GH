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

export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

export function Section({ n, title, lead, children }: { n?: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="sec">
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
