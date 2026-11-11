import sharp from 'sharp';
import { getApp, origin, safeId, siteUrl } from './_app.js';

// /api/og?id=<id>: the app's cover as a 1200x630 JPEG of about 100KB. WhatsApp drops preview images over a few hundred
// KB, and many covers are 0.5-2MB PNG screenshots. Without a cover, a screenshot of the site; failing that, the A&I icon.
const W = 1200;
const H = 630;

async function grab(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 200 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const card = (buf) => sharp(buf, { failOn: 'none' }).rotate().resize(W, H, { fit: 'cover', position: 'top' }).flatten({ background: '#f4f3f0' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();

export default async function handler(req, res) {
  const id = safeId(req.query.id);
  const app = id ? await getApp(id).catch(() => null) : null;
  const site = app ? siteUrl(app) : '';
  // ?demo=1: the poster of the app's video first, for a link that opens the video.
  const sources = [req.query.demo && app?.demo?.poster, app?.coverImage, site && `https://image.thum.io/get/width/1200/crop/630/${site}`].filter((s) => s && /^https:\/\//.test(s));
  let out = null;
  for (const src of sources) {
    const buf = await grab(src);
    if (!buf) continue;
    try {
      out = await card(buf);
      break;
    } catch {
      /* not an image, try the next source */
    }
  }
  if (!out) {
    const icon = await grab(`${origin(req)}/icon-512.png`, 5000);
    out = await sharp({ create: { width: W, height: H, channels: 3, background: '#1c2a44' } })
      .composite(icon ? [{ input: await sharp(icon).resize(360, 360).toBuffer(), gravity: 'center' }] : [])
      .jpeg({ quality: 80 })
      .toBuffer();
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000, immutable');
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(out.length));
  res.end(out);
}
