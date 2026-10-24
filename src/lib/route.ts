import { useEffect, useState, useCallback } from 'react';
import type { ActionValue } from './types';

export interface Route {
  app: string | null;
  action: ActionValue | null;
  domain: string | null;
  ctx: string | null;
  q: string;
  view: 'home' | 'table';
  links: boolean;
}

function read(): Route {
  const p = new URLSearchParams(location.search);
  return {
    app: p.get('app'),
    action: (p.get('action') as ActionValue | null) ?? null,
    domain: p.get('domain'),
    ctx: p.get('ctx'),
    q: p.get('q') ?? '',
    view: p.get('view') === 'table' ? 'table' : 'home',
    links: p.get('links') === '1',
  };
}

function write(r: Route) {
  const p = new URLSearchParams();
  if (r.view === 'table') p.set('view', 'table');
  if (r.app) p.set('app', r.app);
  if (r.action) p.set('action', r.action);
  if (r.domain) p.set('domain', r.domain);
  if (r.ctx) p.set('ctx', r.ctx);
  if (r.q) p.set('q', r.q);
  if (r.links) p.set('links', '1');
  const s = p.toString();
  return `${location.pathname}${s ? `?${s}` : ''}`;
}

export const hasFilters = (r: Route) => !!(r.q.trim() || r.action || r.domain || r.ctx || r.links);

/** The whole view state lives in the address, so "copy link" shares exactly what is on screen. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  const go = useCallback((patch: Partial<Route>, replace = false) => {
    setRoute((prev) => {
      const next = { ...prev, ...patch };
      const url = write(next);
      if (url !== `${location.pathname}${location.search}`) {
        if (replace) history.replaceState(null, '', url);
        else history.pushState(null, '', url);
      }
      return next;
    });
  }, []);
  return { route, go };
}
