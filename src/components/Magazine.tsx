import { useEffect, useState } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';

/** The magazine "חוט" is its own app (MaAmarim-GH). The portfolio only shows its door: it reads the same tables and keeps no content. */
export const MAG_URL = 'https://maamarim-gh.vercel.app/';

/** Which magazine source each portfolio app writes. */
export const MAG_SOURCE: Record<string, { src: string; label: string }> = {
  'app-tarbutgilui-gh': { src: 'culture', label: 'תרבות וגילוי' },
  'app-1775492522623': { src: 'mahut', label: 'מהות' },
  'app-1793845500000': { src: 'ishy', label: 'מהמרחב הפנימי' },
};
const SRC_LABEL: Record<string, string> = { culture: 'תרבות וגילוי', mahut: 'מהות', ishy: 'מהמרחב הפנימי' };

interface Art { key: string; source: string; title: string; lede: string | null; image: string | null; created_at: string }
interface Issue { id: string; number: number; title: string; question: string; intro: string }

const small = (url: string | null, w: number) => {
  const mark = '/storage/v1/object/public/';
  if (!url || !url.startsWith(SUPABASE_URL) || !url.includes(mark)) return url ?? undefined;
  return `${SUPABASE_URL}/storage/v1/render/image/public/${url.split(mark)[1]}?width=${w}&quality=72&resize=contain`;
};
const clean = (t: string | null | undefined) => (t ?? '').replace(/\*\*/g, '');
const LIST = 'key,source,title,lede,image,created_at';

/** Section 05 of the home page: the cover of the current issue, the newest articles, and the way in. */
export default function Magazine() {
  const [state, setState] = useState<{ issue: Issue | null; items: Art[]; latest: Art[]; total: number; threads: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const [issues, latest, count, threads] = await Promise.all([
        supabase.from('mag_issues').select('id,number,title,question,intro').eq('status', 'published').order('number', { ascending: false }).limit(1),
        supabase.from('mag_articles').select(LIST).order('created_at', { ascending: false }).limit(3),
        supabase.from('mag_articles').select('key', { count: 'exact', head: true }),
        supabase.from('mag_threads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      ]);
      if (issues.error || latest.error) throw new Error('mag');
      const issue = (issues.data?.[0] as Issue | undefined) ?? null;
      let items: Art[] = [];
      if (issue) {
        const its = await supabase.from('mag_issue_items').select('article_key,role,position').eq('issue_id', issue.id).order('position');
        const keys = (its.data ?? []).map((i) => i.article_key as string);
        const arts = keys.length ? await supabase.from('mag_articles').select(LIST).in('key', keys) : { data: [] };
        const by = new Map(((arts.data ?? []) as Art[]).map((a) => [a.key, a]));
        const lead = (its.data ?? []).find((i) => i.role === 'lead')?.article_key as string | undefined;
        items = [...keys].sort((a, b) => Number(b === lead) - Number(a === lead)).map((k) => by.get(k)).filter(Boolean) as Art[];
      }
      if (live) setState({ issue, items, latest: (latest.data ?? []) as Art[], total: count.count ?? 0, threads: threads.count ?? 0 });
    })().catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  if (failed) return <p className="band-note">המגזין לא נטען כרגע. אפשר לפתוח אותו ישירות: <a className="link" href={MAG_URL} target="_blank" rel="noreferrer">חוט</a></p>;
  if (!state) return <p className="mono dim">טוען את המגזין</p>;
  const { issue, items, latest, total, threads } = state;
  const lead = items[0];
  const open = (q = '') => `${MAG_URL}${q}`;

  return (
    <div className="mag">
      <a className="mag-cover" href={open(issue ? `?issue=${issue.id}` : '')} target="_blank" rel="noreferrer">
        {lead?.image && <img src={small(lead.image, 960)} alt="" />}
        <span className="mag-veil">
          <span className="mono">{issue ? `גיליון ${String(issue.number).padStart(2, '0')}` : 'המגזין'}</span>
          <b>{issue?.title ?? 'חוט'}</b>
          <i>{issue?.question}</i>
          <span className="mag-enter">כניסה למגזין</span>
        </span>
      </a>
      <div className="mag-side">
        <p className="mag-lead">{clean(issue?.intro) || 'המאמרים נשארים באפליקציות שבהן נכתבו. המגזין מחבר ביניהם.'}</p>
        <p className="mono dim">{total} מאמרים · {Object.keys(SRC_LABEL).length} אפליקציות כותבות · {threads} חוטים מאושרים</p>
        <h3>בגיליון</h3>
        <ol className="mag-list">
          {items.slice(0, 7).map((a, i) => (
            <li key={a.key}>
              <a href={open(`?a=${a.key}${issue ? `&from=issue:${issue.id}` : ''}`)} target="_blank" rel="noreferrer">
                <span className="mono">{String(i + 1).padStart(2, '0')}</span><b>{clean(a.title)}</b><span className="mono dim">{SRC_LABEL[a.source] ?? a.source}</span>
              </a>
            </li>
          ))}
        </ol>
        <h3>שלושת האחרונים שנכתבו</h3>
        <div className="mag-latest">
          {latest.map((a) => (
            <a key={a.key} href={open(`?a=${a.key}`)} target="_blank" rel="noreferrer">
              {a.image && <img src={small(a.image, 320)} alt="" loading="lazy" />}
              <span><b>{clean(a.title)}</b><i>{clean(a.lede)}</i><em className="mono dim">{SRC_LABEL[a.source] ?? a.source}</em></span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** On the page of an app that writes articles: its articles, each opening in the magazine. */
export function MagazineFor({ appId }: { appId: string }) {
  const m = MAG_SOURCE[appId];
  const [list, setList] = useState<Art[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!m) return;
    let live = true;
    supabase.from('mag_articles').select(LIST, { count: 'exact' }).eq('source', m.src).order('created_at', { ascending: false }).limit(6)
      .then(({ data, count }) => { if (live) { setList((data ?? []) as Art[]); setTotal(count ?? 0); } });
    return () => { live = false; };
  }, [m]);
  if (!m || !list.length) return null;
  return (
    <section className="band mag-for">
      <header className="band-head">
        <span className="mono">M</span>
        <h2>{total} מאמרים נכתבו כאן, ונקראים במגזין</h2>
        <a className="link" href={`${MAG_URL}?view=library&src=${m.src}`} target="_blank" rel="noreferrer">לכל המאמרים של {m.label}</a>
      </header>
      <div className="mag-latest wide">
        {list.map((a) => (
          <a key={a.key} href={`${MAG_URL}?a=${a.key}&src=${m.src}&from=lib`} target="_blank" rel="noreferrer">
            {a.image && <img src={small(a.image, 320)} alt="" loading="lazy" />}
            <span><b>{clean(a.title)}</b><i>{clean(a.lede)}</i></span>
          </a>
        ))}
      </div>
    </section>
  );
}
