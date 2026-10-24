import { motion } from 'framer-motion';
import type { AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { ACTIONS } from '../lib/facets';
import { thumbOf } from '../lib/format';

interface Props {
  apps: AppData[];
  facets: Facet[];
  go: (p: Partial<Route>) => void;
}

/** Domain against action. Every cell is a door; an empty cell is a gap worth noticing. */
export default function Matrix({ apps, facets, go }: Props) {
  const domains = facets.filter((f) => f.kind === 'domain');
  const max = Math.max(1, ...domains.flatMap((d) => ACTIONS.map((a) => apps.filter((x) => x.action === a.value && x.domains?.includes(d.value)).length)));

  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th className="corner mono">תחום / פעולה</th>
            {ACTIONS.map((a) => (
              <th key={a.value} scope="col">
                <button className="axis" onClick={() => go({ action: a.value, domain: null, app: null })} title={a.question}>
                  {a.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {domains.map((d, i) => (
            <tr key={d.value}>
              <th scope="row">
                <button className="axis" onClick={() => go({ domain: d.value, action: null, app: null })}>
                  {d.label}
                </button>
              </th>
              {ACTIONS.map((a) => {
                const cell = apps.filter((x) => x.action === a.value && x.domains?.includes(d.value));
                const n = cell.length;
                return (
                  <td key={a.value}>
                    {n ? (
                      <motion.button
                        className="cell"
                        style={{ ['--d' as string]: n / max }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.03 }}
                        onClick={() => go({ domain: d.value, action: a.value, app: null })}
                        title={cell.map((x) => x.name).join(' · ')}
                        aria-label={`${d.label}, ${a.label}: ${n} אפליקציות`}
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
                      <span className="gap" title={`אין עדיין אפליקציה: ${a.label} ב${d.label}`} aria-label="פער" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
