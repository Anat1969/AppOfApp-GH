import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { readPdf } from './pdf';
import type { Slip } from './types';
import { MONTH_NAMES } from './parse';

export interface Job { key: string; name: string; state: 'reading' | 'ok' | 'replaced' | 'error' | 'password' | 'skipped'; msg?: string; file: File; slipId?: string }

interface Uploader {
  jobs: Job[];
  busy: boolean;
  pick: () => void;
  pickFolder: () => void;
  take: (files: FileList | File[] | null) => void;
  retry: (job: Job, password: string) => void;
  clearJobs: () => void;
}

const Ctx = createContext<Uploader | null>(null);
export const useUploader = () => useContext(Ctx)!;

/**
 * One uploader for the whole app (Anat, 2026-11-04: "כפתור בו אני מעלה את כל התלושים שיש לי ואתה ממפה אותם").
 * Takes many PDFs, or a whole folder; reads them one by one in the browser; the map shows the outcome per month.
 */
export function UploaderProvider({ children, onSlip, has }: { children: ReactNode; onSlip: (s: Slip) => void; has: (id: string) => boolean }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const seen = useRef(new Set<string>());

  const setJob = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const run = useCallback(async (job: Job, password?: string) => {
    setJob(job.key, { state: 'reading', msg: undefined });
    try {
      const s = await readPdf(job.file, password);
      const replaced = has(s.id) || seen.current.has(s.id);
      seen.current.add(s.id);
      onSlip(s);
      setJob(job.key, {
        state: replaced ? 'replaced' : 'ok', slipId: s.id,
        msg: `${MONTH_NAMES[s.month - 1]} ${s.year}, לבנק ${Math.round(s.summary.bank).toLocaleString('he-IL')} ₪${replaced ? ' (החליף תלוש קודם של אותו חודש)' : ''}${s.warnings.length ? `. לבדיקה: ${s.warnings.join(' ')}` : ''}`,
      });
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'PasswordException') setJob(job.key, { state: 'password', msg: password ? 'הסיסמה לא נכונה. נסי שוב.' : 'הקובץ נעול. הקלידי את הסיסמה (לרוב מספר תעודת הזהות).' });
      else setJob(job.key, { state: 'error', msg: err.message || 'הקובץ לא נקרא.' });
    }
  }, [has, onSlip]);

  const take = useCallback((list: FileList | File[] | null) => {
    const all = [...(list ?? [])];
    const pdfs = all.filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    const stamp = Date.now();
    const fresh: Job[] = pdfs.map((f, i) => ({ key: `${stamp}-${i}`, name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, state: 'reading', file: f }));
    const skipped: Job[] = all.length - pdfs.length > 0
      ? [{ key: `${stamp}-skip`, name: `${all.length - pdfs.length} קבצים אחרים`, state: 'skipped', msg: 'לא קובצי PDF, דילגתי עליהם.', file: all[0] }]
      : [];
    if (!fresh.length && !skipped.length) return;
    seen.current = new Set();
    setJobs([...fresh, ...skipped]);
    fresh.reduce((p, j) => p.then(() => run(j)), Promise.resolve());
  }, [run]);

  const value: Uploader = {
    jobs,
    busy: jobs.some((j) => j.state === 'reading'),
    pick: () => files.current?.click(),
    pickFolder: () => folder.current?.click(),
    take,
    retry: (job, pw) => run(job, pw),
    clearJobs: () => setJobs([]),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <input ref={files} type="file" accept="application/pdf,.pdf" multiple hidden data-testid="slip-files" onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      {/* webkitdirectory: a whole folder of payslips at once */}
      <input ref={folder} type="file" multiple hidden data-testid="slip-folder" {...({ webkitdirectory: '', directory: '' } as object)} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </Ctx.Provider>
  );
}

/** The main button: every page has it, so adding slips is always one click away. */
export function UploadButton({ big }: { big?: boolean }) {
  const u = useUploader();
  return (
    <div className={`upload-btns ${big ? 'big' : ''}`}>
      <button type="button" className="btn primary" onClick={u.pick} disabled={u.busy}>{u.busy ? 'קורא תלושים...' : 'העלאת כל התלושים'}</button>
      <button type="button" className="btn" onClick={u.pickFolder} disabled={u.busy}>בחירת תיקייה שלמה</button>
    </div>
  );
}

/** Drop zone + the button, with the privacy line. */
export default function Upload({ compact }: { compact?: boolean }) {
  const u = useUploader();
  const [over, setOver] = useState(false);
  return (
    <div
      className={`upload ${compact ? 'compact' : ''} ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); u.take(e.dataTransfer.files); }}
    >
      <div className="upload-text">
        <span className="drop-title">{compact ? 'עוד תלושים?' : 'העלי את כל התלושים שיש לך'}</span>
        <span className="drop-sub">בוחרים את כל קובצי ה-PDF יחד, או תיקייה שלמה, או גוררים לכאן. כל שנה וכל חודש. האפליקציה ממפה אותם לפי החודש שכתוב בתלוש, וחודש שהועלה פעמיים מתעדכן.</span>
        <span className="drop-lock">הקבצים נקראים בתוך הדפדפן ונשמרים רק במכשיר הזה. שום דבר לא נשלח לשרת.</span>
      </div>
      <UploadButton big={!compact} />
    </div>
  );
}

/** What happened to each file in the last upload. */
export function Jobs() {
  const u = useUploader();
  const [pw, setPw] = useState('');
  if (!u.jobs.length) return null;
  const count = (s: Job['state'][]) => u.jobs.filter((j) => s.includes(j.state)).length;
  const label: Record<Job['state'], string> = { reading: 'קורא...', ok: 'נקרא', replaced: 'עודכן', error: 'לא נקרא', password: 'נעול', skipped: 'דילגתי' };
  return (
    <div className="jobs-box">
      <div className="jobs-head">
        <b>{u.busy ? `קורא ${count(['ok', 'replaced', 'error', 'password']) + 1} מתוך ${count(['reading', 'ok', 'replaced', 'error', 'password'])}...` : `ההעלאה האחרונה: ${count(['ok', 'replaced'])} נקראו${count(['error', 'password']) ? `, ${count(['error', 'password'])} לא` : ''}`}</b>
        {!u.busy && <button type="button" className="btn ghost" onClick={u.clearJobs}>הסתרה</button>}
      </div>
      <ul className="jobs">
        {u.jobs.map((j) => (
          <li key={j.key} className={j.state}>
            <span className="job-name">{j.name}</span>
            <span className="job-state">{label[j.state]}</span>
            {j.msg && <span className="job-msg">{j.msg}</span>}
            {j.state === 'password' && (
              <form className="pw" onSubmit={(e) => { e.preventDefault(); u.retry(j, pw); }}>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="סיסמת הקובץ" aria-label="סיסמת הקובץ" />
                <button type="submit" className="btn">פתיחה</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
