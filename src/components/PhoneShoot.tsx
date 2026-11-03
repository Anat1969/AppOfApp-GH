import { useEffect, useRef, useState } from 'react';
import { edit, uploadImage } from '../lib/supabase';
import { fetchApp, kb, shrink } from '../lib/phone';
import type { AppData } from '../lib/types';

type Step = 'loading' | 'ready' | 'preview' | 'sending' | 'done' | 'error';

/** The phone side of "from the phone": one screen, one big button, the photo becomes the app's cover. */
export default function PhoneShoot({ appId }: { appId: string }) {
  const [app, setApp] = useState<AppData | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<{ file: File; url: string; before: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'צילום מהטלפון · Apps';
    fetchApp(appId)
      .then((a) => {
        if (!a) throw new Error('האפליקציה לא נמצאה. אולי נמחקה, או שהקוד ישן.');
        setApp(a);
        setStep('ready');
      })
      .catch((e) => {
        setError((e as Error).message || 'לא ניתן לטעון את האפליקציה');
        setStep('error');
      });
  }, [appId]);

  const take = async (f?: File | null) => {
    if (!f || !f.type.startsWith('image/')) return;
    const small = await shrink(f);
    setPhoto({ file: small, url: URL.createObjectURL(small), before: f.size });
    setStep('preview');
  };

  const send = async () => {
    if (!photo) return;
    setStep('sending');
    setError('');
    try {
      const url = await uploadImage(appId, 'cover', photo.file);
      // read the app again right before saving, so a change made on the computer meanwhile is kept
      const fresh = (await fetchApp(appId)) ?? app!;
      const now = new Date().toISOString();
      const data: AppData = {
        ...fresh,
        coverImage: url,
        updatedAt: now,
        changeLog: [{ id: `c-${Date.now()}`, date: now, text: 'תמונת שער מהטלפון (ענת)', type: 'design' }, ...(fresh.changeLog ?? [])],
      };
      await edit('save_app', { id: appId, data });
      setApp(data);
      setStep('done');
    } catch (e) {
      setError((e as Error).message || 'השליחה נכשלה');
      setStep('preview');
    }
  };

  const again = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setStep('ready');
    input.current?.click();
  };

  return (
    <div className="shoot" dir="rtl">
      <header className="shoot-bar">
        <a href={import.meta.env.BASE_URL} className="shoot-home">
          תיק האפליקציות
        </a>
        <span className="mono">מהטלפון למסך</span>
      </header>

      <main className="shoot-main">
        {step === 'loading' && <p className="mono shoot-note">טוען את האפליקציה</p>}
        {step === 'error' && (
          <>
            <p className="shoot-insight">הקישור לא הוביל לאפליקציה.</p>
            <p className="shoot-note">{error}</p>
            <p className="shoot-note">פתחי שוב את "מהטלפון" במחשב, וסרקי את הקוד החדש.</p>
          </>
        )}

        {app && step !== 'error' && (
          <>
            <span className="mono shoot-label">תמונת שער עבור</span>
            <h1 className="shoot-name">{app.name}</h1>
          </>
        )}

        {step === 'ready' && (
          <>
            <p className="shoot-insight">
              <mark className="hl">צילום אחד</mark>, והוא כבר על המסך במחשב.
            </p>
            <button className="solid shoot-big" onClick={() => input.current?.click()}>
              צילום או בחירת תמונה
            </button>
            {app?.coverImage && (
              <figure className="shoot-now">
                <img src={app.coverImage} alt="" />
                <figcaption className="mono">התמונה הנוכחית</figcaption>
              </figure>
            )}
          </>
        )}

        {(step === 'preview' || step === 'sending') && photo && (
          <>
            <img className="shoot-photo" src={photo.url} alt="התמונה שצולמה" />
            <p className="mono shoot-note">
              {photo.file.size < photo.before ? (
                <>
                  הוקטנה בטלפון עצמו: <b>{kb(photo.before)}</b> ל-<b>{kb(photo.file.size)}</b>
                </>
              ) : (
                <>
                  קטנה מספיק, נשלחת כמו שהיא: <b>{kb(photo.file.size)}</b>
                </>
              )}
            </p>
            {error && <p className="shoot-error">לא נשלח: {error}. אפשר לנסות שוב.</p>}
            <div className="shoot-row">
              <button className="solid shoot-big" onClick={send} disabled={step === 'sending'}>
                {step === 'sending' ? 'שולח...' : 'שמירה כתמונת שער'}
              </button>
              <button className="ghost" onClick={again} disabled={step === 'sending'}>
                צילום אחר
              </button>
            </div>
          </>
        )}

        {step === 'done' && photo && (
          <>
            <img className="shoot-photo" src={photo.url} alt="התמונה שנשמרה" />
            <p className="shoot-insight shoot-ok">נשמר. התמונה מופיעה עכשיו במחשב.</p>
            <p className="shoot-note">השינוי נרשם ביומן העבודה של האפליקציה, והגרסה הקודמת נשמרה.</p>
            <button className="ghost shoot-big" onClick={again}>
              צילום נוסף במקומה
            </button>
          </>
        )}
      </main>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}
