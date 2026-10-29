import { useState } from 'react';
import type { ActionValue, AppData, Facet } from '../lib/types';
import { ACTIONS } from '../lib/facets';
import type { AddPrefill } from './Matrix';
import Dialog from './Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  apps: AppData[];
  facets: Facet[];
  prefill: AddPrefill;
  onCreate: (a: AppData) => Promise<boolean>;
}

/** Adding an app is the first purpose of the app of apps: the form opens and saves on every device, no link needed. */
export default function AddAppDialog({ open, onClose, apps, facets, prefill, onCreate }: Props) {
  const [name, setName] = useState(prefill.name ?? '');
  const [url, setUrl] = useState('');
  const [action, setAction] = useState<ActionValue | ''>(prefill.action ?? '');
  const [domains, setDomains] = useState<string[]>(prefill.domain ? [prefill.domain] : []);
  const [desc, setDesc] = useState(prefill.desc ?? '');
  const [busy, setBusy] = useState(false);
  const dup = name.trim() && apps.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const app: AppData = {
      id: `app-${Date.now()}`,
      name: name.trim(),
      title: name.trim(),
      tag: 'App',
      desc: desc.trim(),
      problem: '',
      solution: '',
      previewUrl: url.trim(),
      action: action || undefined,
      domains,
      contexts: [],
      keywords: [],
      createdAt: now,
      updatedAt: now,
      linkAddedAt: url.trim() ? now : undefined,
    };
    const ok = await onCreate(app);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} title="הוספת אפליקציה חדשה" onClose={onClose}>
      {(
        <div className="form">
          <label>
            <span className="mono">שם</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="שם קצר, בלי קידומת" />
          </label>
          {dup && <p className="warn">כבר קיימת אפליקציה בשם הזה.</p>}
          <label>
            <span className="mono">קישור</span>
            <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <div className="form-block">
            <span className="mono">פעולה: מה יוצאים איתו</span>
            <div className="facet-chips">
              {ACTIONS.map((a) => (
                <button key={a.value} type="button" className={`chip ${action === a.value ? 'on' : ''}`} onClick={() => setAction(a.value)} title={a.question}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-block">
            <span className="mono">תחום</span>
            <div className="facet-chips">
              {facets.filter((f) => f.kind === 'domain').map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`chip ${domains.includes(f.value) ? 'on' : ''}`}
                  onClick={() => setDomains((d) => (d.includes(f.value) ? d.filter((x) => x !== f.value) : [...d, f.value]))}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="mono">תיאור קצר</span>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </label>
          <div className="row end">
            <button className="ghost" onClick={onClose}>
              ביטול
            </button>
            <button className="solid" onClick={submit} disabled={!name.trim() || busy}>
              {busy ? 'שומר...' : 'הוספה לתיק'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
