import { getApp, lineOf, origin, safeId, siteUrl, version } from './_app.js';

// /s/<id> (rewrite in vercel.json). Link-preview robots get the og: tags; people go straight on to the app.
const BOTS = /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|skypeuripreview|pinterest|vkshare|redditbot|applebot|googlebot|bingbot|embedly|iframely|preview|crawler|spider|bot\b/i;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export default async function handler(req, res) {
  const id = safeId(req.query.id);
  const base = origin(req);
  const app = id ? await getApp(id).catch(() => null) : null;
  if (!app) {
    res.statusCode = 302;
    res.setHeader('Location', `${base}/`);
    return res.end();
  }
  const target = siteUrl(app) || `${base}/?app=${encodeURIComponent(id)}`;
  const ua = String(req.headers['user-agent'] || '');
  if (!BOTS.test(ua)) {
    res.statusCode = 302;
    res.setHeader('Location', target);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.end();
  }
  const title = app.name || 'אפליקציה';
  const line = lineOf(app);
  const image = `${base}/api/og?id=${encodeURIComponent(id)}&v=${version(app)}`;
  const self = `${base}/s/${encodeURIComponent(id)}`;
  const host = target.replace(/^https?:\/\//, '').replace(/\/$/, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Never cached at the edge: the same address answers robots with this page and people with a redirect.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'User-Agent');
  res.end(`<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(line)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="A&amp;I · אד' ענת שטיבלמן">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(line || host)}">
<meta property="og:url" content="${esc(self)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="he_IL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(line)}">
<meta name="twitter:image" content="${esc(image)}">
<script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>
</head><body><p><a href="${esc(target)}">${esc(title)}</a></p></body></html>`);
}
