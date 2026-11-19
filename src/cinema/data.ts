import { useCallback, useEffect, useRef, useState } from 'react';
import { BUCKET, edit, supabase } from '../lib/supabase';
import type { AppData, Facet } from '../lib/types';

/** One row of the live feed `aoa_cinema()`: a video file in storage, a demo on an app's own site, or a film added by link. */
export interface Film {
  key: string;
  bucket: string | null;
  url: string | null;
  private: boolean;
  /** An older take of a demo video: kept, not screened. */
  old: boolean;
  app_id: string | null;
  kind: 'demo' | 'creation';
  title: string | null;
  named: boolean;
  note: string | null;
  domains: string[] | null;
  hidden: boolean;
  featured: boolean;
  poster: string | null;
  duration: number | null;
  size: number | null;
  created_at: string;
}

export interface Reel extends Film {
  app?: AppData;
  name: string;
  subjects: string[];
  isNew: boolean;
  /** Screened in the hall: public file, current take, not hidden. */
  showing: boolean;
}

export const KIND: Record<Film['kind'], string> = { demo: 'הדגמה', creation: 'יצירה' };
const WEEK = 7 * 86_400_000;

export function toReels(films: Film[], apps: AppData[]): Reel[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  // an untitled creation is numbered inside its app, oldest first, so the number never changes when a film is added
  const count = new Map<string, number>();
  const no = new Map<string, number>();
  [...films].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((f) => {
    if (f.title || f.kind !== 'creation') return;
    const n = (count.get(f.app_id ?? '') ?? 0) + 1;
    count.set(f.app_id ?? '', n);
    no.set(f.key, n);
  });
  return films.map((f) => {
    const app = f.app_id ? byId.get(f.app_id) : undefined;
    const base = app?.name ?? 'סרט בלי אפליקציה';
    return {
      ...f,
      app,
      name: f.title ?? (f.kind === 'demo' ? base : `${base} · סרט ${no.get(f.key) ?? 1}`),
      subjects: f.domains?.length ? f.domains : app?.domains ?? [],
      isNew: Date.now() - new Date(f.created_at).getTime() < WEEK,
      showing: !!f.url && !f.private && !f.old && !f.hidden,
    };
  });
}

/**
 * The programme changes on every visit: opening films first, then one film from each app in turn (apps in a new
 * random order), so two films of the same app are never neighbours while another app still waits.
 */
export function programme(reels: Reel[], seed: number): Reel[] {
  let s = seed || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const groups = new Map<string, Reel[]>();
  reels.filter((r) => !r.featured).forEach((r) => {
    const k = r.app_id ?? r.key;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  });
  const order = [...groups.values()].map((g) => ({ g, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.g);
  const out = reels.filter((r) => r.featured);
  for (let i = 0; order.some((g) => g.length > i); i++) order.forEach((g) => g[i] && out.push(g[i]));
  return out;
}

export function useCinema() {
  const [films, setFilms] = useState<Film[]>([]);
  const [apps, setApps] = useState<AppData[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [arrived, setArrived] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [f, a, v] = await Promise.all([
      supabase.rpc('aoa_cinema'),
      quiet ? null : supabase.from('aoa_apps').select('id,data'),
      quiet ? null : supabase.from('aoa_facets').select('kind,value,label,synonyms,position').order('position'),
    ]);
    if (f.error || a?.error || v?.error) {
      if (!quiet) setError('לא ניתן לטעון את הסרטים כרגע.');
    } else {
      const list = (f.data ?? []) as Film[];
      // a film that was not here a minute ago: say so, it has just joined the programme
      if (known.current) {
        const fresh = list.filter((x) => !known.current!.has(x.key)).map((x) => x.key);
        if (fresh.length) setArrived((p) => [...fresh, ...p]);
      }
      known.current = new Set(list.map((x) => x.key));
      setFilms(list);
      if (a) setApps((a.data ?? []).map((r) => ({ ...(r.data as AppData), id: r.id })));
      if (v) setFacets(((v.data ?? []) as Facet[]).map((x) => ({ ...x, synonyms: x.synonyms ?? [] })));
      setError('');
    }
    setLoading(false);
  }, []);

  // New films join by themselves: the feed is read again every minute and whenever the tab comes back.
  useEffect(() => {
    load();
    const again = () => document.visibilityState === 'visible' && load(true);
    const t = setInterval(again, 60_000);
    document.addEventListener('visibilitychange', again);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', again);
    };
  }, [load]);

  const save = useCallback(async (key: string, patch: Partial<Film>) => {
    setFilms((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch, named: 'title' in patch ? !!patch.title : f.named } : f)));
    const { error: e } = await supabase.rpc('aoa_video_save', { p_key: key, p: patch });
    if (e) throw new Error(e.message);
    setSavedAt(Date.now());
  }, []);

  const reset = useCallback(async (key: string) => {
    const { error: e } = await supabase.rpc('aoa_video_delete', { p_key: key });
    if (e) throw new Error(e.message);
    setSavedAt(Date.now());
    await load(true);
  }, [load]);

  /** A file goes to the app's folder in aoa-media; the feed finds it there, no registration. */
  const upload = useCallback(async (appId: string, file: File, title: string) => {
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const path = `${appId.replace(/[^\w-]/g, '')}/film-${Date.now()}.${ext}`;
    const { token } = await edit<{ token: string }>('sign_upload', { path });
    const { error: e } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type || 'video/mp4' });
    if (e) throw e;
    if (title.trim()) await supabase.rpc('aoa_video_save', { p_key: `${BUCKET}/${path}`, p: { title: title.trim() } });
    await load(true);
  }, [load]);

  const addLink = useCallback(async (appId: string, url: string, title: string) => {
    const key = `link:${crypto.randomUUID()}`;
    const { error: e } = await supabase.rpc('aoa_video_save', { p_key: key, p: { url, app_id: appId, title: title.trim() } });
    if (e) throw new Error(e.message);
    await load(true);
  }, [load]);

  return { films, apps, facets, loading, error, arrived, savedAt, reload: load, save, reset, upload, addLink };
}

export const fmtTime = (s?: number | null) => (s && isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
export const fmtDate = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'היום' : d === 1 ? 'אתמול' : d < 30 ? `לפני ${d} ימים` : new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
};
