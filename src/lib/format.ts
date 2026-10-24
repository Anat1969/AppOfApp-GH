import type { AppData, ChangeLogEntry, ChangeType } from './types';

export const PLACEHOLDERS = [
  'תאר את הרקע',
  'תאר את הבעיה',
  'תאר את הפתרון',
  'הזן יכולת',
  'משמעות והסבר',
];

/** Seed text from the old "new app" template counts as empty. */
export const clean = (v?: string | null) => {
  const t = (v ?? '').trim();
  return !t || PLACEHOLDERS.some((p) => t.includes(p)) ? '' : t;
};

/** Old button labels carry decorative arrows; the new design has none. */
export const stripArrows = (v?: string) => (v ?? '').replace(/[←→⟵⟶➜➔]/g, '').replace(/\s+-\s+/g, ' · ').trim();

export const withProtocol = (url: string) => (/^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`);

/** The public app address, never an editor or a private project page. */
export function siteUrl(app: Pick<AppData, 'previewUrl' | 'websiteUrl' | 'editUrl'>): string | undefined {
  for (const [index, value] of [app.previewUrl, app.websiteUrl, app.editUrl].entries()) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(withProtocol(trimmed));
      if (!['http:', 'https:'].includes(url.protocol) || url.hostname === 'localhost') continue;
      if (index === 2 && !['.base44.app', '.lovable.app', '.github.io', '.vercel.app'].some((d) => url.hostname.endsWith(d))) continue;
      return url.href;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function platformOf(url?: string): string {
  if (!url) return '';
  const u = url.toLowerCase();
  if (u.includes('lovable')) return 'Lovable';
  if (u.includes('base44')) return 'Base44';
  if (u.includes('vercel.app')) return 'Vercel';
  if (u.includes('github.io')) return 'GitHub Pages';
  if (u.includes('netlify')) return 'Netlify';
  if (u.includes('gemini.google')) return 'Gemini';
  if (u.includes('canva.com')) return 'Canva';
  if (u.includes('claude.ai')) return 'Claude';
  if (u.startsWith('file:')) return 'קובץ מקומי';
  return 'אתר';
}

/** Project name as it appears in the hosting service. */
export function projectName(url?: string): string {
  if (!url) return '';
  try {
    const u = new URL(withProtocol(url));
    if (u.hostname.endsWith('.github.io')) return u.pathname.split('/').filter(Boolean)[0] ?? u.hostname.split('.')[0];
    if (['.vercel.app', '.lovable.app', '.base44.app', '.netlify.app'].some((d) => u.hostname.endsWith(d))) return u.hostname.split('.')[0];
    return u.hostname;
  } catch {
    return '';
  }
}

export const thumbOf = (app: AppData) => {
  if (app.coverImage) return app.coverImage;
  const s = siteUrl(app);
  return s ? `https://image.thum.io/get/width/640/crop/400/${s}` : '';
};

export const time = (d?: string) => (d ? new Date(d).getTime() || 0 : 0);
export const createdOf = (a: AppData) => time(a.createdAt ?? a.linkAddedAt ?? a.updatedAt);
export const activityOf = (a: AppData) => Math.max(time(a.createdAt), time(a.updatedAt), time(a.linkAddedAt), ...(a.changeLog ?? []).map((e) => time(e.date)));

export function fmtDate(d?: string | number, short = false) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: short ? '2-digit' : 'numeric' });
}

export function relative(d?: string | number) {
  const t = typeof d === 'number' ? d : time(d);
  if (!t) return '';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return `לפני ${Math.floor(days / 365)} שנים`;
}

export const CHANGE_TYPES: { value: ChangeType; label: string }[] = [
  { value: 'feature', label: 'יכולת חדשה' },
  { value: 'fix', label: 'תיקון' },
  { value: 'design', label: 'עיצוב' },
  { value: 'content', label: 'תוכן' },
  { value: 'deploy', label: 'פריסה' },
];

/** The old single "changeNote" becomes the first entry of the log. */
export function changeLogOf(app: AppData): ChangeLogEntry[] {
  const list = [...(app.changeLog ?? [])];
  if (!list.length && app.changeNote) {
    list.push({ id: 'legacy', date: app.changeNoteDate ?? app.updatedAt ?? new Date().toISOString(), text: app.changeNote, type: 'feature' });
  }
  return list.sort((a, b) => time(b.date) - time(a.date));
}

/** Architectural sheet number: A-001 by creation order. */
export const sheetNo = (n: number) => `A-${String(n).padStart(3, '0')}`;
