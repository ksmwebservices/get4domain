// Image upload: the real UploadsController + the shared MediaService behind a real HTTP server (multer, sharp, static serving), with REAL image files.
// Needs no database (a stand-in records the media ledger). Uses UPLOADS_DIR so nothing touches the real uploads folder.
// [feat:website-manager.uploads] covers the shared-service rules; the guard that no endpoint bypasses the service is scripts/website-manager/uploads-guard.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
require('reflect-metadata');
const sharp = require('sharp');
const { dist, ok, section, finish } = require('../security-verify/harness');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-uploads-'));
process.env.UPLOADS_DIR = path.join(tmp, 'public');
delete process.env.PUBLIC_API_URL;

const { UploadsController } = dist('uploads/uploads.controller');
const { MediaService } = dist('uploads/media.service');
const { PrismaService } = dist('prisma/prisma.service');
const U = dist('uploads/uploads.util');
const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');

const rows = []; let usedBytes = 0;
const stub = {
  billingTerm: { findFirst: async () => null },
  mediaAsset: {
    aggregate: async () => ({ _sum: { bytes: usedBytes, originalBytes: 0 } }),
    create: async ({ data }) => { rows.push(data); return data; },
    createMany: async ({ data }) => { rows.push(...data); return { count: data.length }; },
  },
};

const SVG_OK = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f40"/></svg>');
const SVG_SCRIPT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const SVG_ONLOAD = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>');
const SVG_EXT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://evil.example/x.svg"/></svg>');
const HTML_AS_PNG = Buffer.from('<!doctype html><html><script>alert(1)</script></html>');

async function upload(base, buf, { type, filename = 'x', kind } = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), filename);
  const r = await fetch(`${base}/uploads${kind ? `?kind=${kind}` : ''}`, { method: 'POST', body: fd });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
const msg = (r) => JSON.stringify(r.json);

(async () => {
  // real pictures
  const PNG_ALPHA = await sharp({ create: { width: 3000, height: 2000, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
  const JPG_EXIF = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3366cc' } }).jpeg().withExif({ IFD0: { Copyright: 'Secret Studio', Make: 'CameraCo' } }).toBuffer();
  const WEBP = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#33cc66' } }).webp().toBuffer();
  const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(64, 3)]);
  const BIG = await sharp({ create: { width: 1700, height: 1700, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).png({ compressionLevel: 0 }).toBuffer();

  section('detection helpers (bytes, not labels)');
  ok('PNG / JPEG / WebP / SVG are recognised from their bytes', U.detectImage(PNG_ALPHA)?.ext === '.png' && U.detectImage(JPG_EXIF)?.ext === '.jpg' && U.detectImage(WEBP)?.ext === '.webp' && U.detectImage(SVG_OK)?.ext === '.svg');
  ok('HTML, text and empty buffers are not images', U.detectImage(HTML_AS_PNG) === null && U.detectImage(Buffer.from('hello')) === null && U.detectImage(Buffer.alloc(0)) === null);

  class TestModule {}
  Module({ controllers: [UploadsController], providers: [MediaService, { provide: PrismaService, useValue: stub }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useStaticAssets(U.uploadsDir(), U.uploadsStaticOptions);
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const meta = async (url) => sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).metadata();

  try {
    section('[feat:website-manager.uploads] A PNG, JPG and WebP are all accepted, resized for the web, with the original kept');
    const png = await upload(base, PNG_ALPHA, { type: 'image/png', filename: 'logo.png', kind: 'GALLERY' });
    ok('a large PNG is accepted (it is NOT refused)', png.status < 300 && png.json.url && png.json.originalUrl, `${png.status} ${msg(png)}`);
    const pm = await meta(png.json.url);
    ok('the web copy is shrunk to the gallery size and keeps its transparency', pm.width === 1600 && pm.height === 1067 && pm.hasAlpha === true, J(pm));
    const orig = Buffer.from(await (await fetch(png.json.originalUrl)).arrayBuffer());
    ok('the original is kept untouched, byte for byte', orig.equals(PNG_ALPHA));
    const jpg = await upload(base, JPG_EXIF, { type: 'image/jpeg', filename: 'photo.jpg', kind: 'BANNER' });
    const jmeta = await meta(jpg.json.url);
    ok('a JPG is accepted and its camera and copyright data is removed from the web copy', jpg.status < 300 && !jmeta.exif, J(jmeta));
    ok('while the original still holds it (nothing is lost)', !!(await meta(jpg.json.originalUrl)).exif);
    const web = await upload(base, WEBP, { type: 'image/webp', filename: 'p.webp' });
    ok('a WebP is accepted', web.status < 300 && /\.webp$/.test(web.json.url), msg(web));
    const gif = await upload(base, GIF, { type: 'image/gif', filename: 'g.gif' });
    ok('a GIF is kept as it is', gif.status < 300 && /\.gif$/.test(gif.json.url));
    const svg = await upload(base, SVG_OK, { type: 'image/svg+xml', filename: 'v.svg' });
    ok('a clean SVG is accepted', svg.status < 300 && /\.svg$/.test(svg.json.url));
    const served = await fetch(png.json.url);
    ok('served with the right content type, nosniff and a long cache time', /image\/png/.test(served.headers.get('content-type')) && served.headers.get('x-content-type-options') === 'nosniff' && /max-age=86400/.test(served.headers.get('cache-control') || ''));
    const svgServed = await fetch(svg.json.url);
    ok('an SVG is additionally served sandboxed', /default-src 'none'/.test(svgServed.headers.get('content-security-policy') || ''));

    section('[feat:website-manager.logo-png] A logo gives a favicon and a share image, and a PNG logo keeps its transparency');
    const logo = await upload(base, PNG_ALPHA, { type: 'image/png', filename: 'logo.png', kind: 'LOGO' });
    ok('the logo is accepted', logo.status < 300 && logo.json.url, msg(logo));
    const lm = await meta(logo.json.url);
    ok('the logo is shrunk to 800 px wide and stays a PNG with transparency', lm.width === 800 && lm.format === 'png' && lm.hasAlpha === true, J(lm));
    const fm = await meta(logo.json.favicon); const om = await meta(logo.json.ogImage);
    ok('a 64 px favicon and a 1200 x 630 share image are made automatically', fm.width === 64 && fm.height === 64 && om.width === 1200 && om.height === 630, J({ fm, om }));
    ok('every file is recorded in the media ledger for the plan limit', rows.some((r) => r.kind === 'LOGO') && rows.some((r) => r.kind === 'FAVICON') && rows.some((r) => r.kind === 'OG'));

    section('[feat:website-manager.uploads] Refusals say what happened and what to do');
    const html = await upload(base, HTML_AS_PNG, { type: 'image/png', filename: 'evil.png' });
    ok('HTML labelled image/png is refused: "not a picture we can use"', html.status === 400 && /not a picture we can use/.test(msg(html)), msg(html));
    const pdf = await upload(base, Buffer.from('%PDF-1.4 fake'), { type: 'application/pdf', filename: 'x.pdf' });
    ok('a PDF is refused the same way, naming PNG, JPG or WebP', pdf.status === 400 && /PNG, JPG or WebP/.test(msg(pdf)), msg(pdf));
    for (const [label, buf] of [['script', SVG_SCRIPT], ['onload', SVG_ONLOAD], ['external link', SVG_EXT]]) {
      const r = await upload(base, buf, { type: 'image/svg+xml', filename: 'x.svg' });
      ok(`an SVG with ${label} is refused with "Export it as a PNG"`, r.status === 400 && /Export it as a PNG/.test(msg(r)), msg(r));
    }
    ok('the test file is really over 5 MB', BIG.length > U.MAX_UPLOAD_BYTES, String(BIG.length));
    const big = await upload(base, BIG, { type: 'image/png', filename: 'big.png' });
    ok('a file over 5 MB is refused with its real size and what to do', big.status === 400 && /This file is \d+(\.\d)? MB\. Upload one under 5 MB/.test(msg(big)), msg(big));
    const HUGE = Buffer.concat([BIG, BIG]);
    const huge = await upload(base, HUGE, { type: 'image/png', filename: 'huge.png' });
    ok('a file over the 12 MB transport limit is also refused in plain words', huge.status === 413 && /Upload one under 5 MB/.test(msg(huge)), msg(huge).slice(0, 200));
    const damaged = await upload(base, Buffer.concat([PNG_ALPHA.subarray(0, 40), Buffer.alloc(200, 7)]), { type: 'image/png', filename: 'broken.png' });
    ok('a damaged picture is refused with "save it again as a PNG or JPG"', damaged.status === 400 && /save it again/.test(msg(damaged)), msg(damaged));
    const none = await fetch(`${base}/uploads`, { method: 'POST', body: new FormData() });
    ok('no file at all is a clear 400', none.status === 400);
    const unknownKind = await upload(base, WEBP, { type: 'image/webp', kind: 'WALLPAPER' });
    ok('an unknown kind of picture is refused', unknownKind.status === 400);
    const before = fs.readdirSync(U.uploadsDir()).length;
    await upload(base, HTML_AS_PNG, { type: 'image/png' });
    ok('a refused upload leaves nothing on disk', fs.readdirSync(U.uploadsDir()).length === before);

    section('[feat:website-manager.plans] The plan limits stored pictures, in plain words');
    usedBytes = 100 * 1024 * 1024;
    const full = await upload(base, WEBP, { type: 'image/webp' });
    ok('over the plan\'s media limit: says the limit, what is used, and to remove pictures or upgrade', full.status === 400 && /includes 100 MB/.test(msg(full)) && /upgrade/i.test(msg(full)), msg(full));
    usedBytes = 0;

    section('a volume the app cannot write to gives a useful error, not a bare 500');
    const savedDir = process.env.UPLOADS_DIR;
    const blocker = path.join(tmp, 'a-file-not-a-folder');
    fs.writeFileSync(blocker, 'x');
    process.env.UPLOADS_DIR = path.join(blocker, 'uploads');
    const broken = await upload(base, WEBP, { type: 'image/webp' });
    ok('write failure gives the "could not be saved ... contact support" message', broken.status === 500 && /could not be saved/i.test(msg(broken)), `${broken.status} ${msg(broken)}`);
    process.env.UPLOADS_DIR = savedDir;
    ok('and uploads work again as soon as the volume is fixed', (await upload(base, WEBP, { type: 'image/webp' })).status < 300);
  } finally {
    await app.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

function J(x) { return JSON.stringify(x); }
