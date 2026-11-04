import { useState, type ReactNode } from 'react';
import { M } from './ui';

export interface Series { key: string; label: string; values: (number | null)[]; tone: 'pos' | 'neg' | 'save' | 'warn' | 'ink' }

const avgOf = (v: (number | null)[]) => { const n = v.filter((x): x is number => x != null); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0; };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const raw = (max - min) / count, pow = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step, out: number[] = [];
  for (let t = lo; ; t += step) { out.push(Math.round(t * 100) / 100); if (t >= max) break; }
  // Headroom: the top tick is always above the highest point, so no line touches the frame.
  if (out[out.length - 1] - max < step * 0.15) out.push(Math.round((out[out.length - 1] + step) * 100) / 100);
  return out;
}

/**
 * Line chart across all months: axes, points, a legend that isolates one line (the others fade), and that line's average
 * as a dashed line (Anat, 2026-11-04: "גרפים קוויים עם נקודות, צירים, השוואות בין כל החודשים, בידוד, ממוצע").
 */
export function LineChart({ labels, series, fmt, isolateFirst, stacked: stackedDefault }: { labels: string[]; series: Series[]; fmt: (n: number) => string; isolateFirst?: boolean; stacked?: boolean }) {
  const [iso, setIso] = useState<string | null>(isolateFirst ? series[0]?.key ?? null : null);
  const [stacked, setStacked] = useState(!!stackedDefault);
  const W = 720, H = 280, L = 70, R = 16, T = 16, B = 34;
  const vals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (labels.length < 2 || !vals.length) return <p className="chart-empty">הגרף יופיע כשיהיו לפחות שני חודשים.</p>;
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  // RTL: the first month sits on the right, like the rest of the page.
  const x = (i: number) => W - R - (i / (labels.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const shown = iso ? series.filter((s) => s.key === iso) : series;
  const layout = series.length > 1 && (
    <div className="lc-layout" role="group" aria-label="תצוגת הגרף">
      <button type="button" className={`lc-key ${stacked ? '' : 'on'}`} aria-pressed={!stacked} onClick={() => setStacked(false)}>יחד</button>
      <button type="button" className={`lc-key ${stacked ? 'on' : ''}`} aria-pressed={stacked} onClick={() => setStacked(true)}>אחד מעל השני</button>
    </div>
  );
  // One above the other (Anat, 2026-11-04): each line on its own scale and its own average, same months under each other.
  if (stacked) return (
    <div className="lc">
      <div className="lc-top">{layout}</div>
      {series.map((s) => <MiniLine key={s.key} s={s} labels={labels} fmt={fmt} x={x} W={W} L={L} R={R} />)}
    </div>
  );
  return (
    <div className="lc">
      <div className="lc-top">{layout}<div className="lc-legend" role="group" aria-label="בידוד קו">
        <button type="button" className={`lc-key all ${iso ? '' : 'on'}`} aria-pressed={!iso} onClick={() => setIso(null)}>כל הקווים</button>
        {series.map((s) => (
          <button key={s.key} type="button" className={`lc-key ${s.tone} ${iso === s.key ? 'on' : ''}`} aria-pressed={iso === s.key} onClick={() => setIso(iso === s.key ? null : s.key)}>
            <span className="lc-dot" />{s.label}
          </button>
        ))}
      </div></div>
      <svg className="lc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => `${s.label}: ${s.values.map((v) => (v == null ? '-' : fmt(v))).join(', ')}`).join('. ')}>
        {ticks.map((t) => (
          <g key={t} className="lc-grid"><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>
        ))}
        <line className="lc-axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
        <line className="lc-axis" x1={W - R} x2={W - R} y1={T} y2={H - B} />
        {labels.map((l, i) => <text key={l + i} className="lc-x" x={x(i)} y={H - B + 18} textAnchor="middle">{l}</text>)}
        {shown.map((s) => {
          const a = avgOf(s.values);
          return iso ? (
            <g key={`avg-${s.key}`} className="lc-avg"><line x1={L} x2={W - R} y1={y(a)} y2={y(a)} /><text x={W - R - 6} y={y(a) - 6} textAnchor="end">{`ממוצע ${fmt(a)}`}</text></g>
          ) : null;
        })}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as const));
          const path = pts.reduce((d, p, i) => (p ? `${d}${d && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]}` : d), '');
          const faded = iso && iso !== s.key;
          return (
            <g key={s.key} className={`lc-s ${s.tone} ${faded ? 'faded' : ''}`}>
              <path d={path} />
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={iso === s.key ? 5 : 4}><title>{`${s.label}, ${labels[i]}: ${fmt(s.values[i]!)}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Highest, lowest, average and the last change of a series, as plain sentences. */
export function insightsFor(label: string, values: (number | null)[], labels: string[], fmt: (n: number) => string, goodIsUp = true): string[] {
  const idx = values.map((v, i) => [v, i] as const).filter((p): p is readonly [number, number] => p[0] != null);
  if (idx.length < 2) return [];
  const hi = idx.reduce((a, b) => (b[0] > a[0] ? b : a)), lo = idx.reduce((a, b) => (b[0] < a[0] ? b : a));
  const a = avgOf(values), last = idx[idx.length - 1], prev = idx[idx.length - 2], d = last[0] - prev[0];
  const dir = Math.abs(d) < 1 ? 'לא השתנה' : `${d > 0 ? 'עלה' : 'ירד'} ב-**${fmt(Math.abs(d))}**`;
  const good = Math.abs(d) < 1 ? '' : (d > 0) === goodIsUp ? ' (לטובה)' : ' (לרעה)';
  return [
    `${label}: הגבוה ב${labels[hi[1]]} **${fmt(hi[0])}**, הנמוך ב${labels[lo[1]]} **${fmt(lo[0])}**.`,
    `הממוצע **${fmt(a)}**; ${labels[last[1]]} ${last[0] >= a ? 'מעל ' : 'מתחת ל'}ממוצע ב-${fmt(Math.abs(last[0] - a))}.`,
    `לעומת ${labels[prev[1]]}, ${label} ${dir}${good}.`,
  ];
}

/** Every chart with its explanation and what it shows (Anat: "כל גרף - ההסבר שלו והתובנות שעולות ממנו"). */
export function ChartCard({ q, how, insights, children }: { q: string; how: string; insights: string[]; children: ReactNode }) {
  return (
    <figure className="chart-card2">
      <figcaption>
        <h3>{q}</h3>
        <p className="how"><b>איך לקרוא:</b> {how}</p>
      </figcaption>
      {children}
      {insights.length > 0 && (
        <div className="chart-insights">
          <b>מה רואים</b>
          <ul>{insights.map((t) => <li key={t}><M>{t}</M></li>)}</ul>
        </div>
      )}
    </figure>
  );
}

/** One series on its own scale, with its average: the stacked view. */
function MiniLine({ s, labels, fmt, x, W, L, R }: { s: Series; labels: string[]; fmt: (n: number) => string; x: (i: number) => number; W: number; L: number; R: number }) {
  const H = 130, T = 22, B = 26;
  const v = s.values.filter((n): n is number => n != null);
  // A flat or nearly flat line still gets a readable scale: pad by 5% of the value, never repeat a label.
  const lo = Math.min(...v), hi = Math.max(...v), pad = Math.max(Math.abs(hi) * 0.05, (hi - lo) * 0.25, 1);
  const ticks = [...new Set(niceTicks(lo - pad, hi + pad, 2).map((t) => fmt(t)))].length < 2 ? [lo - pad, hi + pad] : niceTicks(lo - pad, hi + pad, 2);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const y = (n: number) => T + (1 - (n - y0) / (y1 - y0 || 1)) * (H - T - B);
  const a = avgOf(s.values);
  const pts = s.values.map((n, i) => (n == null ? null : [x(i), y(n)] as const));
  const path = pts.reduce((d, p, i) => (p ? `${d}${d && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]}` : d), '');
  return (
    <svg className="lc-svg mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.label}: ${s.values.map((n) => (n == null ? '-' : fmt(n))).join(', ')}`}>
      <text className={`lc-mini-title ${s.tone}`} x={W - R} y={14} textAnchor="end">{s.label}</text>
      {ticks.map((t) => <g key={t} className="lc-grid"><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{fmt(t)}</text></g>)}
      <g className="lc-avg"><line x1={L} x2={W - R} y1={y(a)} y2={y(a)} /><text x={W - R - 6} y={y(a) - 5} textAnchor="end">{`ממוצע ${fmt(a)}`}</text></g>
      {labels.map((l, i) => <text key={l + i} className="lc-x" x={x(i)} y={H - 6} textAnchor="middle">{l}</text>)}
      <g className={`lc-s ${s.tone}`}><path d={path} />{pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={4}><title>{`${s.label}, ${labels[i]}: ${fmt(s.values[i]!)}`}</title></circle>)}</g>
    </svg>
  );
}

/** Axis numbers: thousands with one decimal (20.5K), small amounts in full. */
export const kfmt = (n: number) => (Math.abs(n) >= 10000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toLocaleString('he-IL'));
