import { MONTH_NAMES } from './parse';
import type { Slip } from './types';
import { useUploader } from './Upload';

/**
 * The map of every slip on the device: one row per year, one cell per month.
 * Loaded, just updated, needs a check, or missing; a click opens that month's slip.
 */
export default function SlipMap({ slips, go }: { slips: Slip[]; go: (id: string) => void }) {
  const { jobs } = useUploader();
  if (!slips.length) return null;
  const fresh = new Set(jobs.filter((j) => j.slipId).map((j) => j.slipId));
  const years = [...new Set(slips.map((s) => s.year))].sort((a, b) => b - a);
  const now = new Date();
  const byId = new Map(slips.map((s) => [s.id, s]));
  const missing: string[] = [];
  for (const y of years) {
    const last = y === now.getFullYear() ? now.getMonth() : 12; // the current month's slip comes out next month
    const first = Math.min(...slips.filter((s) => s.year === y).map((s) => s.month));
    // The current year counts from January; an older first year starts where its slips start.
    for (let m = y === Math.min(...years) && y !== now.getFullYear() ? first : 1; m <= last; m++) if (!byId.has(`${y}-${String(m).padStart(2, '0')}`)) missing.push(`${MONTH_NAMES[m - 1]} ${y}`);
  }
  const flagged = slips.filter((s) => s.warnings.length);
  return (
    <section className="map" aria-label="מפת התלושים">
      <header className="map-head">
        <h2>מפת התלושים</h2>
        <p>
          {`${slips.length} תלושים${years.length > 1 ? ` מ-${years.length} שנים` : ''}. `}
          {missing.length ? `חסרים ${missing.length}: ${missing.join(', ')}. ` : 'אין חודשים חסרים. '}
          {flagged.length ? `${flagged.length} לבדיקה.` : ''}
        </p>
      </header>
      <div className="map-grid" role="table">
        <div className="map-row head" role="row">
          <span role="columnheader" />
          {MONTH_NAMES.map((m) => <span key={m} role="columnheader">{m.slice(0, 3)}</span>)}
          <span role="columnheader">לבנק בשנה</span>
        </div>
        {years.map((y) => {
          const ys = slips.filter((s) => s.year === y);
          return (
            <div key={y} className="map-row" role="row">
              <span className="map-year" role="rowheader">{y}</span>
              {MONTH_NAMES.map((name, i) => {
                const id = `${y}-${String(i + 1).padStart(2, '0')}`;
                const s = byId.get(id);
                const future = y > now.getFullYear() || (y === now.getFullYear() && i >= now.getMonth());
                if (!s) return <span key={id} role="cell" className={`cell ${future ? 'future' : missing.includes(`${name} ${y}`) ? 'missing' : 'none'}`} title={future ? 'עוד לא יצא' : 'חסר'}>{future ? '' : missing.includes(`${name} ${y}`) ? 'חסר' : ''}</span>;
                return (
                  <button key={id} type="button" role="cell" className={`cell on ${s.warnings.length ? 'warn' : ''} ${fresh.has(id) ? 'fresh' : ''}`} onClick={() => go(id)} title={`${name} ${y}: ברוטו ${Math.round(s.summary.totalPay).toLocaleString('he-IL')} ₪, לבנק ${Math.round(s.summary.bank).toLocaleString('he-IL')} ₪${s.warnings.length ? `. ${s.warnings.join(' ')}` : ''}`}>
                    <b>{(s.summary.bank / 1000).toFixed(1)}K</b>
                    <i>{(s.summary.totalPay / 1000).toFixed(1)}K</i>
                  </button>
                );
              })}
              <span className="map-total" role="cell">{Math.round(ys.reduce((a, s) => a + s.summary.bank, 0)).toLocaleString('he-IL')} ₪</span>
            </div>
          );
        })}
      </div>
      <ul className="map-legend">
        <li><span className="cell on sw" />נקרא: למעלה לבנק, למטה ברוטו (אלפי ₪)</li>
        <li><span className="cell on fresh sw" />הועלה עכשיו</li>
        <li><span className="cell on warn sw" />לבדיקה</li>
        <li><span className="cell missing sw" />חסר</li>
      </ul>
    </section>
  );
}
