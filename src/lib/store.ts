import { useCallback, useEffect, useRef, useState } from 'react';
import { edit, supabase } from './supabase';
import type { AppData, Category, Facet, SaveState } from './types';
import { toast } from '../components/Toasts';

const SAVE_DELAY = 800;

export function useStore() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef(new Map<string, AppData>());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [a, c, f] = await Promise.all([
      supabase.from('aoa_apps').select('id,data,created_at,updated_at'),
      supabase.from('aoa_categories').select('value,label,position').order('position'),
      supabase.from('aoa_facets').select('kind,value,label,synonyms,position').order('position'),
    ]);
    if (a.error || c.error || f.error) {
      setLoadError('לא ניתן לטעון את הנתונים כרגע.');
    } else {
      setApps(
        (a.data ?? []).map((row) => ({
          ...(row.data as AppData),
          id: row.id,
          createdAt: (row.data as AppData).createdAt ?? (row.data as AppData).linkAddedAt ?? row.created_at,
        })),
      );
      setCategories((c.data ?? []) as Category[]);
      setFacets(((f.data ?? []) as Facet[]).map((x) => ({ ...x, synonyms: x.synonyms ?? [] })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Every edit is saved online on its own, a moment after typing stops. A save that fails is kept on this device
  // (in case the tab closes) and retried until it goes through, so no change is lost (Anat, 2026-10-27).
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const retries = useRef(new Map<string, number>());
  const PENDING = 'aoa-pending-edits';
  const keep = (app: AppData | null, id: string) => {
    try {
      const all = JSON.parse(localStorage.getItem(PENDING) || '{}');
      if (app) all[id] = app;
      else delete all[id];
      localStorage.setItem(PENDING, JSON.stringify(all));
    } catch {
      /* storage blocked: memory only */
    }
  };

  const flush = useCallback(async (id: string) => {
    const app = latest.current.get(id);
    if (!app) return;
    latest.current.delete(id);
    try {
      await edit('save_app', { id, data: app });
      retries.current.delete(id);
      if (!latest.current.has(id)) keep(null, id);
      setLastSaved(Date.now());
      if (!latest.current.size) setSaveState('saved');
    } catch (e) {
      // keep the newest version and try again: 2s, 5s, 15s, then every 30s
      if (!latest.current.has(id)) latest.current.set(id, app);
      keep(latest.current.get(id)!, id);
      const n = (retries.current.get(id) ?? 0) + 1;
      retries.current.set(id, n);
      setSaveState('error');
      if (n === 1) toast(`השמירה לא עברה, מנסה שוב אוטומטית: ${(e as Error).message}`, 'error');
      const t = timers.current.get(id);
      if (t) clearTimeout(t);
      timers.current.set(id, setTimeout(() => flush(id), [2000, 5000, 15000][n - 1] ?? 30000));
    }
  }, []);

  // Edits left from a closed tab or a lost connection are sent again when the app opens.
  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(PENDING) || '{}') as Record<string, AppData>;
      for (const [id, app] of Object.entries(all)) {
        latest.current.set(id, app);
        setApps((prev) => prev.map((a) => (a.id === id ? app : a)));
        flush(id);
      }
    } catch {
      /* nothing pending */
    }
  }, [flush]);

  // Closing the tab while a change is still on its way asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (latest.current.size) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, []);

  /** Optimistic update, debounced save per app. */
  const updateApp = useCallback(
    (app: AppData, opts: { stamp?: boolean } = {}) => {
      const next = opts.stamp === false ? app : { ...app, updatedAt: new Date().toISOString() };
      setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      latest.current.set(next.id, next);
      keep(next, next.id);
      setSaveState('saving');
      const t = timers.current.get(next.id);
      if (t) clearTimeout(t);
      timers.current.set(next.id, setTimeout(() => flush(next.id), SAVE_DELAY));
    },
    [flush],
  );

  const addApp = useCallback(async (app: AppData) => {
    setSaveState('saving');
    try {
      await edit('save_app', { id: app.id, data: app });
      setApps((prev) => [app, ...prev]);
      setSaveState('saved');
      toast('האפליקציה נוספה');
      return true;
    } catch (e) {
      setSaveState('error');
      toast(`ההוספה נכשלה: ${(e as Error).message}`, 'error');
      return false;
    }
  }, []);

  const deleteApp = useCallback(async (id: string) => {
    try {
      await edit('delete_app', { id });
      setApps((prev) => prev.filter((a) => a.id !== id));
      toast('האפליקציה נמחקה');
      return true;
    } catch (e) {
      toast(`המחיקה נכשלה: ${(e as Error).message}`, 'error');
      return false;
    }
  }, []);

  const saveCategory = useCallback(async (cat: Category) => {
    try {
      await edit('save_category', { ...cat });
      setCategories((prev) => {
        const has = prev.some((c) => c.value === cat.value);
        return has ? prev.map((c) => (c.value === cat.value ? cat : c)) : [...prev, cat];
      });
      return true;
    } catch (e) {
      toast(`שמירת הקטגוריה נכשלה: ${(e as Error).message}`, 'error');
      return false;
    }
  }, []);

  const deleteCategory = useCallback(async (value: string) => {
    try {
      await edit('delete_category', { value });
      setCategories((prev) => prev.filter((c) => c.value !== value));
      return true;
    } catch (e) {
      toast(`מחיקת הקטגוריה נכשלה: ${(e as Error).message}`, 'error');
      return false;
    }
  }, []);

  const saveFacet = useCallback(async (f: Facet) => {
    try {
      await edit('save_facet', { ...f });
      setFacets((prev) => {
        const has = prev.some((x) => x.kind === f.kind && x.value === f.value);
        return has ? prev.map((x) => (x.kind === f.kind && x.value === f.value ? f : x)) : [...prev, f];
      });
      return true;
    } catch (e) {
      toast(`שמירת המילון נכשלה: ${(e as Error).message}`, 'error');
      return false;
    }
  }, []);

  const deleteFacet = useCallback(async (f: Facet) => {
    try {
      await edit('delete_facet', { kind: f.kind, value: f.value });
      setFacets((prev) => prev.filter((x) => !(x.kind === f.kind && x.value === f.value)));
      return true;
    } catch (e) {
      toast(`המחיקה נכשלה: ${(e as Error).message}`, 'error');
      return false;
    }
  }, []);

  return {
    apps, categories, facets, loading, loadError, reload: load,
    saveState, lastSaved,
    updateApp, addApp, deleteApp, saveCategory, deleteCategory, saveFacet, deleteFacet,
  };
}

export type Store = ReturnType<typeof useStore>;
