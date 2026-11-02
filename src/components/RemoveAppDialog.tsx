import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import type { AppData } from '../lib/types';

/**
 * Removing an app (Anat, 2026-11-02: "בזהירות כי זה לא קורה הרבה וזה מסוכן").
 * The button stays locked until the app's name is typed exactly; the app goes to the trash and can be restored.
 */
export default function RemoveAppDialog({ app, sheet, onClose, onRemove }: { app: AppData | null; sheet: string; onClose: () => void; onRemove: (id: string) => Promise<unknown> }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTyped('');
    setBusy(false);
  }, [app?.id]);
  const name = app?.name.trim() ?? '';
  const match = !!name && typed.trim() === name;
  return (
    <Dialog open={!!app} title="ביטול אפליקציה" onClose={onClose}>
      {app && (
        <div className="form remove-app">
          <p className="remove-warn">
            <b>פעולה מסוכנת.</b> האפליקציה <b>"{name}"</b> {sheet && <span className="mono">({sheet})</span>} תוסר מהתיק, מהמפה, מהטבלה ומהחיפוש.
          </p>
          <p className="dim">היא עוברת לסל המחזור, ואפשר לשחזר אותה מההודעה שתופיע מיד אחרי הביטול.</p>
          <label>
            <span className="mono">כדי לאשר, הקלידי את שם האפליקציה</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoFocus autoComplete="off" />
          </label>
          <div className="remove-actions">
            <button className="ghost" onClick={onClose}>
              השארת האפליקציה
            </button>
            <button
              className="danger-solid"
              disabled={!match || busy}
              onClick={async () => {
                setBusy(true);
                await onRemove(app.id);
                setBusy(false);
              }}
            >
              {busy ? 'מבטל...' : 'ביטול האפליקציה'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
