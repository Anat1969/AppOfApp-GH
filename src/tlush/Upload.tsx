import { useRef, useState } from 'react';
import { readPdf } from './pdf';
import type { Slip } from './types';
import { MONTH_NAMES } from './parse';

interface Job { name: string; state: 'reading' | 'ok' | 'error' | 'password'; msg?: string; file: File }

/** Drop or pick payslip PDFs. Each is read in the browser; a protected file asks for its password (usually the ID number). */
export default function Upload({ onSlip, compact }: { onSlip: (s: Slip) => void; compact?: boolean }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const [pw, setPw] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const setJob = (name: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.name === name ? { ...j, ...patch } : j)));

  const run = async (file: File, password?: string) => {
    setJob(file.name, { state: 'reading', msg: undefined });
    try {
      const s = await readPdf(file, password);
      onSlip(s);
      setJob(file.name, { state: 'ok', msg: `${MONTH_NAMES[s.month - 1]} ${s.year}, לבנק ${Math.round(s.summary.bank).toLocaleString('he-IL')} ₪${s.warnings.length ? `. לבדיקה: ${s.warnings.join(' ')}` : ''}` });
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'PasswordException') setJob(file.name, { state: 'password', msg: password ? 'הסיסמה לא נכונה. נסי שוב.' : 'הקובץ נעול. הקלידי את הסיסמה (לרוב מספר תעודת הזהות).' });
      else setJob(file.name, { state: 'error', msg: err.message || 'הקובץ לא נקרא.' });
    }
  };

  const take = (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!list.length) return;
    setJobs((js) => [...js.filter((j) => !list.some((f) => f.name === j.name)), ...list.map((f) => ({ name: f.name, state: 'reading' as const, file: f }))]);
    list.reduce((p, f) => p.then(() => run(f)), Promise.resolve());
  };

  return (
    <div className={`upload ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className={`drop ${over ? 'over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <span className="drop-title">העלאת תלושים</span>
        <span className="drop-sub">גררי לכאן את קובצי ה-PDF של ינואר עד אוקטובר, או לחצי לבחירה. אפשר כמה קבצים יחד.</span>
        <span className="drop-lock">הקבצים נקראים בתוך הדפדפן ונשמרים רק במכשיר הזה. שום דבר לא נשלח לשרת.</span>
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      {jobs.length > 0 && (
        <ul className="jobs">
          {jobs.map((j) => (
            <li key={j.name} className={j.state}>
              <span className="job-name">{j.name}</span>
              <span className="job-state">{{ reading: 'קורא...', ok: 'נקרא', error: 'לא נקרא', password: 'נעול' }[j.state]}</span>
              {j.msg && <span className="job-msg">{j.msg}</span>}
              {j.state === 'password' && (
                <form className="pw" onSubmit={(e) => { e.preventDefault(); run(j.file, pw); }}>
                  <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="סיסמת הקובץ" aria-label="סיסמת הקובץ" />
                  <button type="submit" className="btn">פתיחה</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
