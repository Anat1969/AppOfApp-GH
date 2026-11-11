// APPOFAPP-GH - every write the portfolio makes.
//
// Editing is open on every device, with no link or key (Anat, 2026-10-29: "ביקשתי שלא יהיה צריך קישור
// ... לצורך עריכה"). The safety net below keeps every change recoverable.
// Facets: domains and contexts vocabulary in aoa_facets (save_facet, delete_facet).
// Safety net: before a save the previous version goes to aoa_app_versions (at most one
// per app every 10 minutes), and a delete moves the app to aoa_trash (restore_app).
// Deleted categories and facets go to aoa_trash too, as `category:<value>` / `facet:<kind>:<value>`.
//
// Writes run with the service role, so the tables stay closed to direct writes. Uploads get a signed URL and go straight to storage.
// "generate" distills desc / problem / solution. It reads the app's own site first, then asks
// Gemini (GEMINI_API_KEY, free tier), then Poe (POE_API_KEY, free daily points, OpenAI-compatible,
// reaches Claude / GPT / Gemini with one key), and falls back to Claude (ANTHROPIC_API_KEY).
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

// AUTOMATIC COVER (Anat, 2026-11-11: "אתה שומר את הדף הראשי בתוך חלון מסגרת תמונה של האפליקציה כדי שאני לא אצטרך לבצע
// פעולה זו באופן ידני של חיתוך והדבקה"): an app with an address and no cover gets a picture of its own home page.
// Claude sessions take it with a real browser (tools/cover.cjs); this is the net for an app added from the form or
// straight into the table: the portfolio asks for it when it meets an app without a cover.
const withProtocol = (u: string) => (/^[a-z][a-z\d+.-]*:/i.test(u) ? u : `https://${u}`);
/** Same rule as siteUrl() in src/lib/format.ts: the public app address, never an editor page. */
function siteUrl(app: Record<string, unknown>): string {
  const list = [app.previewUrl, app.websiteUrl, app.editUrl];
  for (let i = 0; i < list.length; i++) {
    const t = String(list[i] ?? '').trim();
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

async function homePicture(id: string, site: string): Promise<string> {
  // A site that refuses (401, 404) or sends the visitor to a sign-in page of its host has no home page to show.
  const page = await fetch(site, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 appofapp' } });
  await page.body?.cancel();
  if (!page.ok || new URL(page.url).hostname !== new URL(site).hostname) return '';
  const r = await fetch(`https://image.thum.io/get/width/1280/crop/800/noanimate/${site}`, { signal: AbortSignal.timeout(40000) });
  const type = (r.headers.get('content-type') ?? '').split(';')[0];
  if (!r.ok || !/^image\/(png|jpeg)$/.test(type)) return '';
  const buf = new Uint8Array(await r.arrayBuffer());
  // A few KB is an error card or an empty page, not a home page.
  if (buf.length < 12000) return '';
  const path = `${id}/cover-${Date.now()}.${type === 'image/png' ? 'png' : 'jpg'}`;
  const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { ...service, 'Content-Type': type }, body: buf });
  return up.ok ? `${SB}/storage/v1/object/public/${BUCKET}/${path}` : '';
}

// The model answers in parts (insight line + explanation) so the hierarchy of the text standard is kept every time;
// the server joins them into "insight. explanation" for desc / problem / solution.
const PART = { type: 'object', additionalProperties: false, required: ['insight', 'detail'], properties: { insight: { type: 'string' }, detail: { type: 'string' } } };
const GEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['desc', 'problem', 'solution'],
  properties: { desc: PART, problem: PART, solution: PART },
};
const G_PART = { type: 'OBJECT', required: ['insight', 'detail'], properties: { insight: { type: 'STRING' }, detail: { type: 'STRING' } } };
type Part = { insight?: string; detail?: string };
const joinPart = (p: Part | string | undefined) => {
  if (!p) return '';
  if (typeof p === 'string') return p.trim();
  const a = (p.insight ?? '').trim().replace(/[.:]+$/, '');
  const b = (p.detail ?? '').trim();
  return a && b ? `${a}. ${b}` : a || b;
};
const compose = (o: Record<string, Part | string>) => ({ desc: joinPart(o.desc), problem: joinPart(o.problem), solution: joinPart(o.solution) });

// The text standard of all of Anat's apps: docs/ai-text-standard.md (keep the two identical).
const GEN_SYSTEM = `את/ה כותב/ת תוכן בעברית לתיק עבודות של אפליקציות שבנתה אדריכלית.
זקק, אל תתאר. עברית טבעית, קצרה ומקצועית, בגוף שלישי. בלי סימני קריאה, בלי אימוג'י, בלי מילים ריקות.

מבנה קבוע לכל שדה, בהיררכיה (insight ו-detail):
1. שורת תובנה (insight): עד 8 מילים, כמו כותרת שמבטאת את העיקר. לא חוזרת על שם האפליקציה.
2. משפט הסבר אחד (detail): עד 20 מילים, שמפרט את התובנה ומוסיף מידע חדש.

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

// Free Gemini models can be busy (503) or slow. Try the configured model, then lighter ones, each with its own
// time limit, so one click still ends with text (Anat's key, 2026-10-27: first call returned 503).
const GEMINI_MODELS = [...new Set([Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])];

async function geminiOnce(key: string, model: string, user: string): Promise<Gen> {
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
          properties: { desc: G_PART, problem: G_PART, solution: G_PART },
        },
      },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw Object.assign(new Error(`Gemini ${model} ${r.status}`), { status: r.status });
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return compose(JSON.parse(text));
}

async function viaGemini(key: string, user: string): Promise<Gen> {
  let last: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      return await geminiOnce(key, model, user);
    } catch (err) {
      last = err;
      const status = (err as { status?: number }).status;
      // a wrong key will not work with another model either
      if (status === 400 || status === 401 || status === 403) throw err;
    }
  }
  throw last;
}

// Poe (Anat, 2026-11-03, from a reel on free chatbots): one OpenAI-compatible endpoint, paid from the account's
// free daily points. It replaces the Claude key that answers 401. The bot name is POE_MODEL; a cheap bot keeps
// the daily points for many clicks. JSON is asked for in the prompt and read leniently (code fences, extra text).
const POE_MODELS = [...new Set([Deno.env.get('POE_MODEL') ?? 'Claude-Haiku-4.5', 'Gemini-2.5-Flash', 'GPT-4o-Mini'])];

function readJson(text: string) {
  const t = text.replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
}

async function viaPoe(key: string, user: string): Promise<Gen> {
  let last: unknown;
  for (const model of POE_MODELS) {
    try {
      const r = await fetch('https://api.poe.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `${GEN_SYSTEM}\nענה ב-JSON בלבד, בלי טקסט נוסף, במבנה: {"desc":{"insight":"","detail":""},"problem":{"insight":"","detail":""},"solution":{"insight":"","detail":""}}`,
            },
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw Object.assign(new Error(`Poe ${model} ${r.status}`), { status: r.status });
      const j = await r.json();
      return compose(readJson(String(j?.choices?.[0]?.message?.content ?? '')));
    } catch (err) {
      last = err;
      const status = (err as { status?: number }).status;
      // a wrong key or no points left will not work with another bot either
      if (status === 401 || status === 402 || status === 403) throw err;
    }
  }
  throw last;
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
  return compose(JSON.parse(text));
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
  const poe = Deno.env.get('POE_API_KEY')?.trim();
  const claude = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  const errors: string[] = [];
  for (const [label, key, run] of [['Gemini', gemini, viaGemini], ['Poe', poe, viaPoe], ['Claude', claude, viaClaude]] as const) {
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
  const hint = gemini || poe ? '' : ' כדי שהניסוח יעבוד בחינם צריך להגדיר ב-Supabase מפתח Gemini חינמי (GEMINI_API_KEY) או מפתח Poe (POE_API_KEY, מ-poe.com/api_key).';
  return json({ error: `${errors.join(', ') || 'אין מפתח ניסוח'}.${hint}` }, 502);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SB || !SK) return json({ error: 'server not configured' }, 500);

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

      // Which AI keys are set (true/false only, never the key) and whether Poe answers (Anat, 2026-11-03: "עשיתי?").
      case 'ai_status': {
        const has = (k: string) => Boolean(Deno.env.get(k)?.trim());
        const poeKey = Deno.env.get('POE_API_KEY')?.trim();
        let poe: string = poeKey ? '' : 'אין מפתח';
        if (poeKey) {
          const r = await fetch('https://api.poe.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${poeKey}` },
            body: JSON.stringify({ model: POE_MODELS[0], max_tokens: 5, messages: [{ role: 'user', content: 'ok' }] }),
            signal: AbortSignal.timeout(20000),
          }).catch((e) => ({ ok: false, status: String(e) }) as const);
          poe = r.ok ? `עובד (${POE_MODELS[0]})` : `שגיאה ${r.status}`;
        }
        return json({ gemini: has('GEMINI_API_KEY'), poe_key: has('POE_API_KEY'), poe, claude: has('ANTHROPIC_API_KEY') });
      }

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

      // The home page as the cover, for an app that has none. One try a day per app; a failed try is recorded on the
      // app (coverTriedAt), so a site that cannot be photographed is not asked again on every visit.
      case 'auto_cover': {
        const id = safeId(body.id);
        const [cur] = await get(`aoa_apps?select=data&id=eq.${id}`);
        if (!cur) return json({ error: 'no such app' }, 404);
        const d = cur.data as Record<string, unknown>;
        if (d.coverImage) return json({ ok: true, coverImage: d.coverImage });
        const site = siteUrl(d);
        if (!site) return json({ ok: false, reason: 'no address' });
        if (d.coverTriedAt && Date.now() - new Date(String(d.coverTriedAt)).getTime() < 86_400_000) return json({ ok: false, reason: 'tried today' });
        const coverImage = await homePicture(id, site).catch(() => '');
        // Read again: the picture took time, and an edit may have been saved meanwhile.
        const [fresh] = await get(`aoa_apps?select=data&id=eq.${id}`);
        const base = (fresh?.data ?? d) as Record<string, unknown>;
        if (base.coverImage) return json({ ok: true, coverImage: base.coverImage });
        const patch = coverImage ? { coverImage, coverAuto: true } : { coverTriedAt: now };
        await rest('PATCH', `aoa_apps?id=eq.${id}`, { data: { ...base, ...patch } }, 'return=minimal');
        return json(coverImage ? { ok: true, coverImage, coverAuto: true } : { ok: false, reason: 'no picture', coverTriedAt: now });
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

      case 'delete_category': {
        const value = safeId(body.value);
        const [cur] = await get(`aoa_categories?select=*&value=eq.${value}`);
        if (cur) await upsert('aoa_trash', { app_id: `category:${value}`, data: cur, deleted_at: now });
        await rest('DELETE', `aoa_categories?value=eq.${value}`);
        return json({ ok: true });
      }

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
        const value = safeId(body.value);
        const [cur] = await get(`aoa_facets?select=*&kind=eq.${kind}&value=eq.${value}`);
        if (cur) await upsert('aoa_trash', { app_id: `facet:${kind}:${value}`, data: cur, deleted_at: now });
        await rest('DELETE', `aoa_facets?kind=eq.${kind}&value=eq.${value}`);
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
