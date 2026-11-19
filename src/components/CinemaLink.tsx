import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Row { app_id: string | null; url: string | null; private: boolean; old: boolean; hidden: boolean }
let feed: Promise<Row[]> | null = null;
const films = () => (feed ??= Promise.resolve(supabase.rpc('aoa_cinema')).then((r) => (r.data ?? []) as Row[]).catch(() => []));

/** On an app page: the way to this app's films in the cinema. Shown only when the app has a film on screen. */
export default function CinemaLink({ appId }: { appId: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let on = true;
    films().then((list) => on && setN(list.filter((f) => f.app_id === appId && f.url && !f.private && !f.old && !f.hidden).length));
    return () => {
      on = false;
    };
  }, [appId]);
  if (!n) return null;
  return (
    <a className="ghost cinema-link" href={`${import.meta.env.BASE_URL}cinema/?app=${encodeURIComponent(appId)}`}>
      {n === 1 ? 'הסרט בקולנוע' : `${n} סרטים בקולנוע`}
    </a>
  );
}
