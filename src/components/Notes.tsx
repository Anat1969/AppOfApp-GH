import type { AppData, Note } from '../lib/types';

export default function Notes({ app, editing, onChange }: { app: AppData; editing: boolean; onChange: (a: AppData) => void }) {
  const notes = app.redNotes ?? [];
  if (!editing && !notes.length) return null;
  const open = notes.filter((n) => !n.resolved).length;
  const set = (next: Note[]) => onChange({ ...app, redNotes: next });
  const patch = (i: number, p: Partial<Note>) => set(notes.map((n, k) => (k === i ? { ...n, ...p } : n)));

  return (
    <section className="panel notes">
      <header className="panel-head">
        <h3>הערות ובדיקות</h3>
        {notes.length > 0 && <span className="mono dim">{open ? `${open} פתוחות מתוך ${notes.length}` : `הכל טופל · ${notes.length}`}</span>}
      </header>
      <ul>
        {notes.map((n, i) => (
          <li key={n.id} className={n.resolved ? 'done' : ''}>
            <label className="check">
              <input type="checkbox" checked={n.resolved} disabled={!editing} onChange={(e) => patch(i, { resolved: e.target.checked })} />
              <span className="box" aria-hidden />
            </label>
            <div className="note-body">
              {editing ? (
                <input value={n.text} onChange={(e) => patch(i, { text: e.target.value })} placeholder="הערה" aria-label="הערה" />
              ) : (
                <p>{n.text}</p>
              )}
              {n.resolved &&
                (editing ? (
                  <textarea value={n.explanation} onChange={(e) => patch(i, { explanation: e.target.value })} placeholder="איך זה טופל" aria-label="הסבר" />
                ) : n.explanation ? (
                  <p className="explain">{n.explanation}</p>
                ) : null)}
            </div>
            {editing && (
              <button className="link" onClick={() => set(notes.filter((_, k) => k !== i))}>
                מחיקה
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <button className="ghost" onClick={() => set([...notes, { id: crypto.randomUUID(), text: '', resolved: false, explanation: '' }])}>
          הוספת הערה
        </button>
      )}
    </section>
  );
}
