import { supabase } from './supabase';
import type { AppData } from './types';

/**
 * From the phone to the screen (Anat, 2026-11-03, tool 2 in Claude-GH docs/tools-bank.md, from a reel on PairDrop):
 * the desktop shows a QR code, the phone opens this app's own address with `shoot=1`, takes a photo and saves it as
 * the cover. No sign-in, no pairing code: editing is open on every device. The desktop sees the new cover by reading
 * the app again every few seconds while the code is open, so it needs no realtime channel and works on Pages too.
 */
export const shootUrl = (appId: string) => {
  const u = new URL(import.meta.env.BASE_URL, location.origin);
  u.searchParams.set('app', appId);
  u.searchParams.set('shoot', '1');
  return u.toString();
};

export const isShootPage = () => new URLSearchParams(location.search).get('shoot') === '1';

/** One app, fresh from the database (public read). */
export async function fetchApp(appId: string): Promise<AppData | null> {
  const { data, error } = await supabase.from('aoa_apps').select('id,data').eq('id', appId);
  if (error) throw error;
  const row = (data ?? []).find((r) => r.id === appId);
  return row ? { ...(row.data as AppData), id: row.id } : null;
}

/**
 * Tool 1 (on-device processing, from VERT): a phone photo of 4-12MB is made smaller on the phone itself, before it is
 * sent, so it uploads fast on a field connection. Longest side 2000px, JPEG 85%. When the browser cannot, the original goes.
 */
export async function shrink(file: File, max = 2000): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], 'phone.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1000))}KB`);
