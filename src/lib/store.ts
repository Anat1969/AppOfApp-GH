import { useCallback, useEffect, useRef, useState } from 'react';
import { edit, readEditorKey, storeEditorKey, supabase } from './supabase';
import type { AppData, Category, Facet, SaveState } from './types';
import { toast } from '../components/Toasts';

const SAVE_DELAY = 800;

export function useStore() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEditor, setIsEditor] = useState(false);
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

  /** Verifies a key with the server and, if valid, keeps it on this device. */
  const connect = useCallback(async (key: string, announce = true) => {
    try {
      await edit('check', {}, key);
      storeEditorKey(key);
      setIsEditor(true);
      if (announce) toast('המכשיר הזה מחובר לעריכה');
      return true;
    } catch {
      storeEditorKey('');
      setIsEditor(false);
      if (announce) toast('מפתח העריכה אינו תקף', 'error');
      return false;
    }
  }, []);

  // A key arrives once as #editor=KEY, is kept on this device and removed from the address.
  useEffect(() => {
    const m = location.hash.match(/editor=([\w-]{16,})/);
    if (m) history.replaceState(null, '', location.pathname + location.search);
    const key = m?.[1] ?? readEditorKey();
    if (key) connect(key, !!m);
  }, [connect]);

  const flush = useCallback(async (id: string) => {
    const app = latest.current.get(id);
    if (!app) return;
    latest.current.delete(id);
    try {
      await edit('save_app', { id, data: app });
      if (!latest.current.size) {
        setSaveState('saved');
        setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2500);
      }
    } catch (e) {
      setSaveState('error');
      toast(`השמירה נכשלה: ${(e as Error).message}`, 'error');
    }
  }, []);

  /** Optimistic update, debounced save per app. */
  const updateApp = useCallback(
    (app: AppData, opts: { stamp?: boolean } = {}) => {
      const next = opts.stamp === false ? app : { ...app, updatedAt: new Date().toISOString() };
      setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
      latest.current.set(next.id, next);
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

  const leaveEditor = useCallback(() => {
    storeEditorKey('');
    setIsEditor(false);
    toast('המכשיר נותק מהעריכה');
  }, []);

  return {
    apps, categories, facets, loading, loadError, reload: load,
    isEditor, connect, leaveEditor, saveState,
    updateApp, addApp, deleteApp, saveCategory, deleteCategory, saveFacet, deleteFacet,
  };
}

export type Store = ReturnType<typeof useStore>;
