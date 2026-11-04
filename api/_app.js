// Shared by /api/share and /api/og (files starting with _ are not functions on Vercel).
// Share links (Anat, 2026-11-04: links sent on WhatsApp show the app's picture only for some apps): the preview comes from
// og: tags, and most apps have none or an image over WhatsApp's size limit. A share link goes through the portfolio,
// which knows every app's cover, serves the tags and a small JPEG, and sends people on to the app itself.
const SUPABASE_URL = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';

export const safeId = (v) => (typeof v === 'string' && /^[\w-]{1,80}$/.test(v) ? v : '');

export async function getApp(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/aoa_apps?select=id,data&id=eq.${encodeURIComponent(id)}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const [row] = await r.json();
  return row ? { ...row.data, id: row.id } : null;
}

const withProtocol = (u) => (/^[a-z][a-z\d+.-]*:/i.test(u) ? u : `https://${u}`);

/** Same rule as siteUrl() in src/lib/format.ts: the public app address, never an editor page. */
export function siteUrl(app) {
  const list = [app.previewUrl, app.websiteUrl, app.editUrl];
  for (let i = 0; i < list.length; i++) {
    const t = (list[i] ?? '').trim();
    if (!t) continue;
    try {
      const u = new URL(withProtocol(t));
      if (!['http:', 'https:'].includes(u.protocol) || u.hostname === 'localhost') continue;
      if (i === 2 && !['.base44.app', '.lovable.app', '.github.io', '.vercel.app'].some((d) => u.hostname.endsWith(d))) continue;
      return u.href;
    } catch {
      continue;
    }
  }
  return '';
}

const PLACEHOLDERS = ['תאר את הרקע', 'תאר את הבעיה', 'תאר את הפתרון', 'הזן יכולת', 'משמעות והסבר'];
const plain = (v) => {
  const t = String(v ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return !t || PLACEHOLDERS.some((p) => t.includes(p)) ? '' : t;
};

/** The insight line of the description (the first sentence), or the page title. */
export function lineOf(app) {
  const d = plain(app.desc);
  const first = d.split(/(?<=[.!?])\s|\n/)[0] ?? '';
  return (first || plain(app.title) || plain(app.problem)).slice(0, 200);
}

export const origin = (req) => `https://${req.headers['x-forwarded-host'] || req.headers.host || 'appofapp-gh.vercel.app'}`;

/** Changes when the cover changes, so WhatsApp and the CDN never keep an old picture under a new cover. */
export const version = (app) => {
  const s = String(app.coverImage || siteUrl(app) || app.id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
