import type { AppData } from './types';
import { toast } from '../components/Toasts';

/**
 * Share link with a picture (Anat, 2026-11-04: on WhatsApp only some app links showed the app's image).
 * The link goes through the portfolio on Vercel (`api/share.js`), which gives WhatsApp, Facebook and the rest the app's
 * name, insight line and cover as a small JPEG (`api/og.js`), and sends people straight on to the app.
 * Always the Vercel address: GitHub Pages cannot run the function.
 */
export const SHARE_BASE = 'https://appofapp-gh.vercel.app/s/';
export const shareUrl = (app: Pick<AppData, 'id'>) => SHARE_BASE + encodeURIComponent(app.id);

export async function copyShare(app: Pick<AppData, 'id'>) {
  const url = shareUrl(app);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('הקישור הועתק. בהדבקה בווטסאפ תופיע תמונת האפליקציה');
}
