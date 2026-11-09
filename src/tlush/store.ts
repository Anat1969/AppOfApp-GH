import { useCallback, useEffect, useState } from 'react';
import { DEFAULTS, type Params } from './calc';
import type { Slip } from './types';

const SLIPS = 'tlush-slips-v1';
const PARAMS = 'tlush-params-v1';

const read = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/** Everything stays in this browser: no server, no account. */
export function useSlips() {
  const [slips, setSlips] = useState<Slip[]>(() => read<Slip[]>(SLIPS, []));
  const [params, setParamsState] = useState<Params>(() => ({ ...DEFAULTS, ...read<Partial<Params>>(PARAMS, {}) }));
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => { if (write(SLIPS, slips)) setSavedAt(Date.now()); }, [slips]);
  useEffect(() => { if (write(PARAMS, params)) setSavedAt(Date.now()); }, [params]);

  const add = useCallback((s: Slip) => setSlips((cur) => [...cur.filter((c) => c.id !== s.id), s].sort((a, b) => a.id.localeCompare(b.id))), []);
  const remove = useCallback((id: string) => setSlips((cur) => cur.filter((c) => c.id !== id)), []);
  const clear = useCallback(() => setSlips([]), []);
  const setParams = useCallback((patch: Partial<Params>) => setParamsState((p) => ({ ...p, ...patch })), []);
  const replaceAll = useCallback((s: Slip[], p?: Partial<Params>) => { setSlips(s.sort((a, b) => a.id.localeCompare(b.id))); if (p) setParamsState({ ...DEFAULTS, ...p }); }, []);

  return { slips, params, add, remove, clear, setParams, replaceAll, savedAt };
}
