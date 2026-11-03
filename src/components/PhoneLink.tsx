import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import Dialog from './Dialog';
import { fetchApp, shootUrl } from '../lib/phone';
import type { AppData } from '../lib/types';

const EVERY = 3000;
const GIVE_UP = 15 * 60_000;

/** The computer side of "from the phone": a QR code to the phone page, and the new cover shows up here on its own. */
export default function PhoneLink({ app, open, onClose, onReceive }: { app: AppData; open: boolean; onClose: () => void; onReceive: (a: AppData) => void }) {
  const url = shootUrl(app.id);
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    if (!open) return;
    setWaiting(true);
    const before = app.coverImage ?? '';
    const started = Date.now();
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (Date.now() - started > GIVE_UP) return setWaiting(false);
      try {
        const fresh = await fetchApp(app.id);
        if (!stop && fresh && (fresh.coverImage ?? '') !== before) {
          onReceive(fresh);
          return;
        }
      } catch {
        /* offline for a moment: keep waiting */
      }
      if (!stop) timer = setTimeout(tick, EVERY);
    };
    let timer = setTimeout(tick, EVERY);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // only the open state and the app restart the wait; the cover it compares to is the one shown when it opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.id]);

  return (
    <Dialog open={open} title="תמונת שער מהטלפון" onClose={onClose}>
      <div className="phone-link">
        <div className="phone-qr" aria-label="קוד QR לצילום מהטלפון" dangerouslySetInnerHTML={{ __html: svg }} />
        <ol className="phone-steps">
          <li>
            <b>סורקים</b> את הקוד במצלמה של הטלפון.
          </li>
          <li>
            <b>מצלמים</b> ולוחצים "שמירה כתמונת שער".
          </li>
          <li>
            התמונה <mark className="hl">מופיעה כאן מעצמה</mark>, בלי כניסה ובלי סיסמה.
          </li>
        </ol>
      </div>
      <p className="mono phone-wait" aria-live="polite">
        {waiting ? 'ממתין לתמונה מהטלפון' : 'ההמתנה הסתיימה אחרי 15 דקות. סגירה ופתיחה מחדש ממשיכות.'}
      </p>
      <p className="phone-url">
        <span className="mono">או לפתוח בטלפון:</span> <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
      </p>
      <p className="mono phone-note">התמונה מוקטנת בטלפון לפני השליחה, והגרסה הקודמת של האפליקציה נשמרת.</p>
    </Dialog>
  );
}
