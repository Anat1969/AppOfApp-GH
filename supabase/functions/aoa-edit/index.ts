// APPOFAPP-GH - every write the portfolio makes.
//
// The editor is recognised by a personal editor key (sent as x-editor-key and
// stored only as a SHA-256 hash in aoa_editor_keys), or by a Supabase session
// whose email is in aoa_admins. The key exists because Google sign-in is off in
// the shared project and email sign-in returns to another app's Site URL.
// Facets: domains and contexts vocabulary in aoa_facets (save_facet, delete_facet).
//
// Writes run with the service role after that check, so the tables stay closed
// to the public. Uploads get a signed URL and go straight to storage.
// "generate" distills desc / problem / solution with Claude (ANTHROPIC_API_KEY).
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
const upsert = (table: string, row: unknown) => rest('POST', table, row, 'resolution=merge-duplicates,return=minimal');
const safeId = (v: unknown) => String(v ?? '').replace(/[^\w-]/g, '').slice(0, 160);

const GEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['desc', 'problem', 'solution'],
  properties: { desc: { type: 'string' }, problem: { type: 'string' }, solution: { type: 'string' } },
};
const GEN_SYSTEM = `את/ה כותב/ת תוכן בעברית לתיק עבודות של אפליקציות שבנתה אדריכלית.
עברית טבעית, קצרה ומקצועית, בגוף שלישי. לא פיוטית ולא מתורגמת. בלי סימני קריאה ובלי אימוג'י.
כל שדה הוא משפט אחד בלבד, עד 18 מילים. עוטפים 2 עד 3 מילות מפתח ב-**כוכביות כפולות**.
- desc: מה האפליקציה עושה.
- problem: הבעיה המרכזית שהיא פותרת.
- solution: איך היא פותרת אותה.
כשיש תוכן קיים: לזקק אותו ולשמור על המשמעות. לא להמציא עובדות שאינן בו.`;

async function generate(body: Record<string, unknown>) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500);
  const name = String(body.name ?? '').trim().slice(0, 300);
  if (!name) return json({ error: 'חסר שם אפליקציה' }, 400);
  const cur = (body.current ?? {}) as Record<string, string>;
  const lines = [
    `שם: ${name}`,
    body.title ? `כותרת: ${String(body.title).slice(0, 300)}` : '',
    body.category ? `קטגוריה: ${String(body.category).slice(0, 100)}` : '',
    body.url ? `כתובת: ${String(body.url).slice(0, 300)}` : '',
    ...(['desc', 'problem', 'solution'] as const).map((k) => (cur[k]?.trim() ? `${k} קיים: ${cur[k].trim().slice(0, 2000)}` : '')),
  ].filter(Boolean);
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: GEN_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: GEN_SCHEMA } },
      messages: [{ role: 'user', content: lines.join('\n') }],
    } as never);
    if (response.stop_reason === 'refusal') return json({ error: 'הבקשה נדחתה' }, 422);
    const text = response.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
    return json(JSON.parse(text));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'עומס זמני, נסו שוב בעוד דקה' }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: `Claude API ${err.status}` }, 502);
    return json({ error: String(err) }, 500);
  }
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
        await upsert('aoa_apps', { id, data, updated_at: now });
        return json({ ok: true, updated_at: now });
      }

      case 'delete_app':
        await rest('DELETE', `aoa_apps?id=eq.${safeId(body.id)}`);
        return json({ ok: true });

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
