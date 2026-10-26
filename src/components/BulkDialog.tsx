import { useMemo, useRef, useState } from 'react';
import type { AppData, Facet } from '../lib/types';
import { actionOf } from '../lib/facets';
import { clean, siteUrl } from '../lib/format';
import { edit } from '../lib/supabase';
import Dialog from './Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  apps: AppData[];
  facets: Facet[];
  onChange: (a: AppData, opts?: { stamp?: boolean }) => void;
}

/** Distills desc / problem / solution for every app that is missing one, one app at a time. */
export default function BulkDialog({ open, onClose, apps, facets, onChange }: Props) {
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const stop = useRef(false);

  const targets = useMemo(
    () => apps.filter((a) => !onlyMissing || !clean(a.desc) || !clean(a.problem) || !clean(a.solution)),
    [apps, onlyMissing],
  );

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setDone(0);
    setLog([]);
    for (const [i, a] of targets.entries()) {
      if (stop.current) break;
      try {
        const r = await edit<{ desc: string; problem: string; solution: string }>('generate', {
          name: a.name,
          title: a.title,
          category: [actionOf(a.action)?.label, ...(a.domains ?? []).map((d) => facets.find((f) => f.kind === 'domain' && f.value === d)?.label)].filter(Boolean).join(', '),
          url: siteUrl(a),
          current: { desc: clean(a.desc), problem: clean(a.problem), solution: clean(a.solution) },
        });
        onChange({ ...a, desc: r.desc, problem: r.problem, solution: r.solution }, { stamp: false });
        setLog((l) => [`${a.name}: נוסח`, ...l]);
      } catch (e) {
        setLog((l) => [`${a.name}: ${(e as Error).message}`, ...l]);
        if (i === 0) break;
      }
      setDone(i + 1);
    }
    setRunning(false);
  };

  return (
    <Dialog open={open} title="ניסוח תוכן לכל האפליקציות" onClose={() => !running && onClose()}>
      <p className="dim">הניסוח האוטומטי מזקק לכל אפליקציה תיאור, בעיה ופתרון: שורת תובנה ומשפט הסבר עם הבלטות, ושומר על המשמעות של מה שכבר כתוב. תאריכי העדכון לא משתנים.</p>
      <label className="row">
        <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} disabled={running} />
        <span>רק אפליקציות שחסר בהן תוכן</span>
      </label>
      <div className="progress" aria-label="התקדמות">
        <span style={{ width: `${targets.length ? (done / targets.length) * 100 : 0}%` }} />
      </div>
      <p className="mono dim">
        {done}/{targets.length}
      </p>
      <div className="row end">
        {running ? (
          <button className="ghost" onClick={() => (stop.current = true)}>
            עצירה
          </button>
        ) : (
          <button className="solid" onClick={run} disabled={!targets.length}>
            התחלה
          </button>
        )}
      </div>
      {log.length > 0 && (
        <ul className="bulk-log mono">
          {log.slice(0, 12).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
