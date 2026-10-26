// APPOFAPP-GH - every write the portfolio makes.
//
// The editor is recognised by a personal editor key (sent as x-editor-key and
// stored only as a SHA-256 hash in aoa_editor_keys), or by a Supabase session
// whose email is in aoa_admins. The key exists because Google sign-in is off in
// the shared project and email sign-in returns to another app's Site URL.
// Facets: domains and contexts vocabulary in aoa_facets (save_facet, delete_facet).
// Safety net: before a save the previous version goes to aoa_app_versions (at most one
// per app every 10 minutes), and a delete moves the app to aoa_trash (restore_app).
//
// Writes run with the service role after that check, so the tables stay closed
// to the public. Uploads get a signed URL and go straight to storage.
// "generate" distills desc / problem / solution. It reads the app's own site first, then asks
// Gemini (GEMINI_API_KEY, free tier) and falls back to Claude (ANTHROPIC_API_KEY).
import Anthropic from 'npm:@anthropic-ai/sdk';

const BUCKET = 'aoa-media';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-editor-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SB = Deno.env.get('SUPABASE_URL') ?? '';
const SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const service = { apikey: SK, Authorization: `Bearer ${SK}` };

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isEditor(req: Request): Promise<boolean> {
  try {
    const key = req.headers.get('x-editor-key') ?? '';
    if (key.length >= 16) {
      const rows = await fetch(`${SB}/rest/v1/aoa_editor_keys?select=key_hash&key_hash=eq.${await sha256(key)}`, { headers: service }).then((r) => r.json());
      if (Array.isArray(rows) && rows.length > 0) return true;
    }
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return false;
    const u = await fetch(`${SB}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SK } });
    if (!u.ok) return false;
    const email = String((await u.json())?.email ?? '').toLowerCase();
    if (!email) return false;
    const admins = await fetch(`${SB}/rest/v1/aoa_admins?select=email&email=eq.${encodeURIComponent(email)}`, { headers: service }).then((r) => r.json());
    return Array.isArray(admins) && admins.length > 0;
  } catch {
    return false;
  }
}

async function rest(method: string, path: string, body?: unknown, prefer?: string) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { ...service, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}
async function get(path: string) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: service });
  return r.ok ? r.json() : [];
}
const upsert = (table: string, row: unknown) => rest('POST', table, row, 'resolution=merge-duplicates,return=minimal');
const safeId = (v: unknown) => String(v ?? '').replace(/[^\w-]/g, '').slice(0, 160);

const GEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['desc', 'problem', 'solution'],
  properties: { desc: { type: 'string' }, problem: { type: 'string' }, solution: { type: 'string' } },
};
// The text standard of all of Anat's apps: docs/ai-text-standard.md (keep the two identical).
const GEN_SYSTEM = `את/ה כותב/ת תוכן בעברית לתיק עבודות של אפליקציות שבנתה אדריכלית.
זקק, אל תתאר. עברית טבעית, קצרה ומקצועית, בגוף שלישי. בלי סימני קריאה, בלי אימוג'י, בלי מילים ריקות.

מבנה קבוע לכל שדה, בהיררכיה:
1. שורת תובנה: עד 8 מילים, כמו כותרת שמבטאת את העיקר. מסתיימת בנקודה.
2. משפט הסבר אחד: עד 20 מילים, שמפרט את התובנה.

הבלטות ב-**כוכביות כפולות**:
- בשורת התובנה: המושג המרכזי בלבד.
- במשפט ההסבר: 2 עד 3 הבלטות, לפרמטרים, מספרים, שמות שיטות ומושגי מפתח.
- לא מבליטים מילות קישור ולא משפט שלם.

השדות:
- desc: מה האפליקציה עושה ולמי.
- problem: הבעיה המרכזית שהיא פותרת, כפער או כמחיר ממשי.
- solution: איך היא פותרת אותה, במנגנון או בפעולה.

עובדות: רק מה שמופיע בשם, בסיווג, באתר האפליקציה או בתוכן הקיים. כשיש תוכן קיים, מזקקים אותו ושומרים על המשמעות.
לא ממציאים נתונים, מספרים או שמות.
`;

/** Title, descriptions and headings of the app's own site: facts for the model, so it does not invent. */
async function siteText(url: string): Promise<string> {
  if (!/^https?:\/\//.test(url)) return '';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'Mozilla/5.0 appofapp' } });
    if (!r.ok) return '';
    const html = (await r.text()).slice(0, 400_000);
    const pick = (re: RegExp) => [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const parts = [
      ...pick(/<title[^>]*>([^<]*)<\/title>/gi),
      ...pick(/<meta[^>]+(?:name|property)=["'](?:description|og:description|og:title)["'][^>]+content=["']([^"']*)["']/gi),
      ...pick(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi).slice(0, 8),
    ];
    const generic = /lovable (app|generated)|^vite|^react app$/i;
    return [...new Set(parts)].filter((t) => !generic.test(t)).join(' | ').slice(0, 1200);
  } catch {
    return '';
  }
}

type Gen = { desc: string; problem: string; solution: string };

async function viaGemini(key: string, user: string): Promise<Gen> {
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GEN_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          required: ['desc', 'problem', 'solution'],
          properties: { desc: { type: 'STRING' }, problem: { type: 'STRING' }, solution: { type: 'STRING' } },
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return JSON.parse(text);
}

async function viaClaude(key: string, user: string): Promise<Gen> {
  const client = new Anthropic({ apiKey: key });
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: GEN_SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: GEN_SCHEMA } },
    messages: [{ role: 'user', content: user }],
  } as never);
  if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה');
  const text = response.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  return JSON.parse(text);
}

async function generate(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim().slice(0, 300);
  if (!name) return json({ error: 'חסר שם אפליקציה' }, 400);
  const url = String(body.url ?? '').trim().slice(0, 300);
  const cur = (body.current ?? {}) as Record<string, string>;
  const site = await siteText(url);
  const user = [
    `שם: ${name}`,
    body.title ? `כותרת: ${String(body.title).slice(0, 300)}` : '',
    body.category ? `סיווג: ${String(body.category).slice(0, 200)}` : '',
    url ? `כתובת: ${url}` : '',
    site ? `מהאתר של האפליקציה: ${site}` : '',
    ...(['desc', 'problem', 'solution'] as const).map((k) => (cur[k]?.trim() ? `${k} קיים: ${cur[k].trim().slice(0, 2000)}` : '')),
  ].filter(Boolean).join('\n');

  const gemini = Deno.env.get('GEMINI_API_KEY')?.trim();
  const claude = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  const errors: string[] = [];
  for (const [label, key, run] of [['Gemini', gemini, viaGemini], ['Claude', claude, viaClaude]] as const) {
    if (!key) continue;
    try {
      const out = await run(key, user);
      if (out?.desc && out?.problem && out?.solution) return json(out);
      errors.push(`${label}: תשובה חסרה`);
    } catch (err) {
      const status = (err as { status?: number }).status;
      errors.push(status ? `${label} ${status}` : String((err as Error).message ?? err));
    }
  }
  const hint = gemini ? '' : ' כדי שהניסוח יעבוד בחינם צריך להגדיר מפתח Gemini חינמי (GEMINI_API_KEY) ב-Supabase.';
  return json({ error: `${errors.join(', ') || 'אין מפתח ניסוח'}.${hint}` }, 502);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SB || !SK) return json({ error: 'server not configured' }, 500);
  if (!(await isEditor(req))) return json({ error: 'not editor' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const now = new Date().toISOString();
  try {
    switch (body.action) {
      case 'check':
        return json({ ok: true });

      case 'save_app': {
        const id = safeId(body.id);
        if (!id) return json({ error: 'bad id' }, 400);
        const data = { ...(body.data as object), id };
        const [cur] = await get(`aoa_apps?select=data&id=eq.${id}`);
        if (cur) {
          const [last] = await get(`aoa_app_versions?select=saved_at&app_id=eq.${id}&order=saved_at.desc&limit=1`);
          if (!last || Date.now() - new Date(last.saved_at).getTime() > 600_000) {
            await rest('POST', 'aoa_app_versions', { app_id: id, data: cur.data }, 'return=minimal');
          }
        }
        await upsert('aoa_apps', { id, data, updated_at: now });
        return json({ ok: true, updated_at: now });
      }

      case 'delete_app': {
        const id = safeId(body.id);
        const [cur] = await get(`aoa_apps?select=data&id=eq.${id}`);
        if (cur) await upsert('aoa_trash', { app_id: id, data: cur.data, deleted_at: now });
        await rest('DELETE', `aoa_apps?id=eq.${id}`);
        return json({ ok: true });
      }

      case 'restore_app': {
        const id = safeId(body.id);
        const [t] = await get(`aoa_trash?select=data&app_id=eq.${id}`);
        if (!t) return json({ error: 'not in trash' }, 404);
        await upsert('aoa_apps', { id, data: { ...t.data, id }, updated_at: now });
        await rest('DELETE', `aoa_trash?app_id=eq.${id}`);
        return json({ ok: true, data: t.data });
      }

      case 'save_category': {
        const value = safeId(body.value);
        const label = String(body.label ?? '').trim().slice(0, 80);
        if (!value || !label) return json({ error: 'bad category' }, 400);
        await upsert('aoa_categories', { value, label, position: Number(body.position ?? 0) || 0 });
        return json({ ok: true });
      }

      case 'delete_category':
        await rest('DELETE', `aoa_categories?value=eq.${safeId(body.value)}`);
        return json({ ok: true });

      case 'save_facet': {
        const kind = body.kind === 'context' ? 'context' : 'domain';
        const value = safeId(body.value);
        const label = String(body.label ?? '').trim().slice(0, 80);
        if (!value || !label) return json({ error: 'bad facet' }, 400);
        const synonyms = (Array.isArray(body.synonyms) ? body.synonyms : [])
          .map((x: unknown) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 40);
        await rest('POST', 'aoa_facets?on_conflict=kind,value', { kind, value, label, synonyms, position: Number(body.position ?? 0) || 0 }, 'resolution=merge-duplicates,return=minimal');
        return json({ ok: true });
      }

      case 'delete_facet': {
        const kind = body.kind === 'context' ? 'context' : 'domain';
        await rest('DELETE', `aoa_facets?kind=eq.${kind}&value=eq.${safeId(body.value)}`);
        return json({ ok: true });
      }

      case 'sign_upload': {
        const path = String(body.path ?? '');
        if (!/^[\w-]+\/[\w.-]+$/.test(path) || path.includes('..')) return json({ error: 'bad path' }, 400);
        const res = await fetch(`${SB}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
          method: 'POST',
          headers: { ...service, 'Content-Type': 'application/json' },
          body: '{}',
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return json({ error: data?.message ?? `sign ${res.status}` }, 502);
        const token = new URL(`http://x${data.url}`).searchParams.get('token');
        if (!token) return json({ error: 'no upload token' }, 502);
        return json({ path, token, publicUrl: `${SB}/storage/v1/object/public/${BUCKET}/${path}` });
      }

      case 'generate':
        return await generate(body);

      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (err) {
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
