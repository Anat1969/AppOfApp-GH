import { useState } from 'react';
import type { AppData, ChangeLogEntry, ChangeType } from '../lib/types';
import { CHANGE_TYPES, changeLogOf, fmtDate, relative } from '../lib/format';

interface Props {
  app: AppData;
  editing: boolean;
  onChange: (a: AppData) => void;
}

export default function ChangeLog({ app, editing, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [type, setType] = useState<ChangeType>('feature');
  const entries = changeLogOf(app);
  if (!editing && !entries.length) return null;

  const commit = (next: ChangeLogEntry[]) => onChange({ ...app, changeLog: next, changeNote: undefined, changeNoteDate: undefined });
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    commit([{ id: crypto.randomUUID(), date: new Date().toISOString(), text, type }, ...entries]);
    setDraft('');
  };
  const patch = (id: string, p: Partial<ChangeLogEntry>) => commit(entries.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const label = (t: ChangeType) => CHANGE_TYPES.find((c) => c.value === t)?.label ?? t;

  return (
    <section className="panel log">
      <header className="panel-head">
        <h3>יומן עבודה</h3>
        {entries.length > 0 && (
          <span className="mono dim">
            {entries.length} רשומות · {relative(entries[0].date)}
          </span>
        )}
      </header>
      {editing && (
        <div className="log-add">
          <div className="seg">
            {CHANGE_TYPES.map((t) => (
              <button key={t.value} className={type === t.value ? 'on' : ''} onClick={() => setType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="row">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="מה נעשה עכשיו? Enter להוספה"
              aria-label="רשומה חדשה ביומן"
            />
            <button className="solid" onClick={add} disabled={!draft.trim()}>
              הוספה
            </button>
          </div>
        </div>
      )}
      <ol className="timeline">
        {entries.map((e) => (
          <li key={e.id} className={`t-${e.type}`}>
            <div className="t-meta">
              {editing ? (
                <>
                  <select value={e.type} onChange={(ev) => patch(e.id, { type: ev.target.value as ChangeType })} aria-label="סוג">
                    {CHANGE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={new Date(e.date).toISOString().slice(0, 10)}
                    onChange={(ev) => ev.target.value && patch(e.id, { date: new Date(ev.target.value).toISOString() })}
                    aria-label="תאריך"
                  />
                  <button className="link" onClick={() => commit(entries.filter((x) => x.id !== e.id))}>
                    מחיקה
                  </button>
                </>
              ) : (
                <>
                  <span className="mono badge">{label(e.type)}</span>
                  <time className="mono dim">{fmtDate(e.date)}</time>
                  <span className="dim">{relative(e.date)}</span>
                </>
              )}
            </div>
            {editing ? <input className="t-text" value={e.text} onChange={(ev) => patch(e.id, { text: ev.target.value })} aria-label="טקסט" /> : <p>{e.text}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
