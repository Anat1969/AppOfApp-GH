import type { AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { ACTIONS } from '../lib/facets';

interface Props {
  apps: AppData[];
  facets: Facet[];
  route: Route;
  go: (p: Partial<Route>) => void;
}

/** Three independent axes; picking in one narrows the others. Counts follow the other active filters. */
export default function Filters({ apps, facets, route, go }: Props) {
  const pass = (a: AppData, skip: 'action' | 'domain' | 'ctx') =>
    (skip === 'action' || !route.action || a.action === route.action) &&
    (skip === 'domain' || !route.domain || !!a.domains?.includes(route.domain)) &&
    (skip === 'ctx' || !route.ctx || !!a.contexts?.includes(route.ctx));

  const row = (title: string, hint: string, items: { value: string; label: string; count: number }[], active: string | null, key: 'action' | 'domain' | 'ctx') => (
    <div className="facet-row">
      <div className="facet-title">
        <span className="mono">{title}</span>
        <span className="dim">{hint}</span>
      </div>
      <div className="facet-chips" role="group" aria-label={title}>
        {items.map((it) => (
          <button
            key={it.value}
            className={`chip ${active === it.value ? 'on' : ''}`}
            disabled={!it.count && active !== it.value}
            onClick={() => go({ [key]: active === it.value ? null : it.value, app: null })}
          >
            {it.label} <span className="mono">{it.count}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="filters-panel">
      {row(
        'פעולה',
        'מה יוצאים איתו',
        ACTIONS.map((a) => ({ value: a.value, label: a.label, count: apps.filter((x) => pass(x, 'action') && x.action === a.value).length })),
        route.action,
        'action',
      )}
      {row(
        'תחום',
        'על מה',
        facets.filter((f) => f.kind === 'domain').map((f) => ({ value: f.value, label: f.label, count: apps.filter((x) => pass(x, 'domain') && x.domains?.includes(f.value)).length })),
        route.domain,
        'domain',
      )}
      {row(
        'הקשר',
        'בשביל מי',
        facets.filter((f) => f.kind === 'context').map((f) => ({ value: f.value, label: f.label, count: apps.filter((x) => pass(x, 'ctx') && x.contexts?.includes(f.value)).length })),
        route.ctx,
        'ctx',
      )}
    </div>
  );
}
