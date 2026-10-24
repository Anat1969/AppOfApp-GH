import { useState } from 'react';
import type { AppData, Category } from '../lib/types';
import Dialog from './Dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  apps: AppData[];
  categories: Category[];
  defaultCategory?: string | null;
  onCreate: (a: AppData) => Promise<boolean>;
}

export default function AddAppDialog({ open, onClose, apps, categories, defaultCategory, onCreate }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [cat, setCat] = useState(defaultCategory ?? '');
  const [desc, setDesc] = useState('');
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
      category: cat || null,
      createdAt: now,
      updatedAt: now,
      linkAddedAt: url.trim() ? now : undefined,
      tags: [],
    };
    const ok = await onCreate(app);
    setBusy(false);
    if (ok) {
      setName('');
      setUrl('');
      setDesc('');
      onClose();
    }
  };

  return (
    <Dialog open={open} title="אפליקציה חדשה" onClose={onClose}>
      <div className="form">
        <label>
          <span className="mono">שם</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="תחום: שם קצר" />
        </label>
        {dup && <p className="warn">כבר קיימת אפליקציה בשם הזה.</p>}
        <label>
          <span className="mono">קישור</span>
          <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </label>
        <label>
          <span className="mono">קטגוריה</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">ללא קטגוריה</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mono">תיאור קצר</span>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
        </label>
        <div className="row end">
          <button className="ghost" onClick={onClose}>
            ביטול
          </button>
          <button className="solid" onClick={submit} disabled={!name.trim() || busy}>
            {busy ? 'שומר...' : 'הוספה'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
