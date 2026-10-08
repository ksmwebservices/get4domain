// Image upload: the real UploadsController behind a real HTTP server (multer, static serving), with fixture files.
// Needs no database. Uses UPLOADS_DIR so nothing touches the real uploads folder.
const fs = require('fs');
const os = require('os');
const path = require('path');
require('reflect-metadata');
const { dist, ok, rejects, section, finish } = require('../security-verify/harness');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-uploads-'));
process.env.UPLOADS_DIR = path.join(tmp, 'public');
delete process.env.PUBLIC_API_URL;

const { UploadsController } = dist('uploads/uploads.controller');
const U = dist('uploads/uploads.util');
const { NestFactory } = require('@nestjs/core');
const { Module } = require('@nestjs/common');

// ── fixtures (real file signatures, not placeholders) ─────────────────────────────────────────
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(64, 3)]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ', 'latin1'), Buffer.alloc(32, 4)]);
const SVG_OK = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f40"/></svg>');
const SVG_SCRIPT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const SVG_ONLOAD = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>');
const SVG_EXT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://evil.example/x.svg"/></svg>');
const HTML_AS_PNG = Buffer.from('<!doctype html><html><script>alert(1)</script></html>');
const TOO_BIG = Buffer.concat([PNG, Buffer.alloc(U.MAX_UPLOAD_BYTES, 9)]);

async function upload(base, buf, { type, filename = 'x', field = 'file' } = {}) {
  const fd = new FormData();
  fd.append(field, new Blob([buf], { type }), filename);
  const r = await fetch(`${base}/uploads`, { method: 'POST', body: fd });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

(async () => {
  section('detection helpers (bytes, not labels)');
  ok('PNG / JPEG / GIF / WebP / SVG are recognised from their bytes', U.detectImage(PNG)?.ext === '.png' && U.detectImage(JPG)?.ext === '.jpg' && U.detectImage(GIF)?.ext === '.gif' && U.detectImage(WEBP)?.ext === '.webp' && U.detectImage(SVG_OK)?.ext === '.svg');
  ok('HTML, text and empty buffers are not images', U.detectImage(HTML_AS_PNG) === null && U.detectImage(Buffer.from('hello')) === null && U.detectImage(Buffer.alloc(0)) === null);
  ok('a clean SVG is safe; script / onload / foreignObject / external href are not', U.svgIsSafe(SVG_OK.toString()) && !U.svgIsSafe(SVG_SCRIPT.toString()) && !U.svgIsSafe(SVG_ONLOAD.toString()) && !U.svgIsSafe(SVG_EXT.toString()) && !U.svgIsSafe('<svg><foreignObject/></svg>'));

  class TestModule {}
  Module({ controllers: [UploadsController] })(TestModule); // plain-JS equivalent of the @Module decorator
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useStaticAssets(U.uploadsDir(), U.uploadsStaticOptions);
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}`;

  try {
    section('upload → served URL, for every allowed format');
    const urls = {};
    for (const [label, buf, type, ext] of [['png', PNG, 'image/png', '.png'], ['jpeg', JPG, 'image/jpeg', '.jpg'], ['gif', GIF, 'image/gif', '.gif'], ['webp', WEBP, 'image/webp', '.webp'], ['svg', SVG_OK, 'image/svg+xml', '.svg']]) {
      const r = await upload(base, buf, { type, filename: `shoe.${label}` });
      const url = (r.json.url ?? r.json.data?.url);
      urls[label] = url;
      ok(`${label}: accepted, URL ends ${ext}, absolute`, r.status < 300 && typeof url === 'string' && url.startsWith(base) && url.endsWith(ext), `${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
      const get = await fetch(url);
      const body = Buffer.from(await get.arrayBuffer());
      ok(`${label}: the served URL is reachable and byte-identical`, get.status === 200 && body.equals(buf));
    }
    const png = await fetch(urls.png);
    ok('served with the right content-type, nosniff, and a long cache time', /image\/png/.test(png.headers.get('content-type')) && png.headers.get('x-content-type-options') === 'nosniff' && /max-age=86400/.test(png.headers.get('cache-control')));
    const svg = await fetch(urls.svg);
    ok('an SVG is additionally served sandboxed (CSP: default-src none; sandbox)', /default-src 'none'/.test(svg.headers.get('content-security-policy') || '') && /sandbox/.test(svg.headers.get('content-security-policy') || ''));
    ok('a raster image does not need (or get) the SVG sandbox header', png.headers.get('content-security-policy') === null);

    section('several images for one product, in order (each upload is independent and unique)');
    const many = [];
    for (let i = 0; i < 5; i += 1) many.push((await upload(base, Buffer.concat([PNG, Buffer.from([i])]), { type: 'image/png' })).json.url);
    ok('5 uploads → 5 distinct URLs, all reachable', new Set(many).size === 5 && (await Promise.all(many.map((u) => fetch(u)))).every((r) => r.status === 200));
    ok('files really are on the configured uploads volume (not the working directory)', fs.readdirSync(U.uploadsDir()).length >= 10 && !fs.existsSync(path.join(process.cwd(), 'uploads', path.basename(many[0]))));

    section('refusals');
    const html = await upload(base, HTML_AS_PNG, { type: 'image/png', filename: 'evil.png' });
    ok('HTML labelled image/png is REFUSED (400) — content is checked, not the label', html.status === 400 && /not a valid image/i.test(JSON.stringify(html.json)), `${html.status}`);
    const mismatch = await upload(base, PNG, { type: 'image/jpeg', filename: 'x.jpg' });
    ok('a PNG labelled image/jpeg is refused (label and bytes must agree)', mismatch.status === 400);
    const pdf = await upload(base, Buffer.from('%PDF-1.4 fake'), { type: 'application/pdf', filename: 'x.pdf' });
    ok('non-image types are refused with a clear message', pdf.status === 400 && /Only image files/.test(JSON.stringify(pdf.json)));
    for (const [label, buf] of [['script', SVG_SCRIPT], ['onload', SVG_ONLOAD], ['external href', SVG_EXT]]) {
      const r = await upload(base, buf, { type: 'image/svg+xml', filename: 'x.svg' });
      ok(`an SVG with ${label} is REFUSED`, r.status === 400 && /scripts or external links/.test(JSON.stringify(r.json)), `${r.status}`);
    }
    const big = await upload(base, TOO_BIG, { type: 'image/png', filename: 'big.png' });
    ok(`a file over ${U.MAX_UPLOAD_BYTES / 1024 / 1024} MB is refused (413)`, big.status === 413, String(big.status));
    const none = await fetch(`${base}/uploads`, { method: 'POST', body: new FormData() });
    ok('no file at all is a clear 400', none.status === 400);
    const before = fs.readdirSync(U.uploadsDir()).length;
    await upload(base, HTML_AS_PNG, { type: 'image/png' });
    ok('a refused upload leaves nothing on disk', fs.readdirSync(U.uploadsDir()).length === before);

    section('a volume the app cannot write to gives a useful error, not a bare 500');
    const savedDir = process.env.UPLOADS_DIR;
    const blocker = path.join(tmp, 'a-file-not-a-folder');
    fs.writeFileSync(blocker, 'x');
    process.env.UPLOADS_DIR = path.join(blocker, 'uploads'); // mkdir under a regular file fails like EACCES/ENOTDIR on a broken volume
    const broken = await upload(base, PNG, { type: 'image/png' });
    ok('write failure → 500 with the "could not be saved … contact support" message', broken.status === 500 && /could not be saved/i.test(JSON.stringify(broken.json)), `${broken.status} ${JSON.stringify(broken.json).slice(0, 120)}`);
    process.env.UPLOADS_DIR = savedDir;
    const again = await upload(base, PNG, { type: 'image/png' });
    ok('…and uploads work again as soon as the volume is fixed', again.status < 300);
  } finally {
    await app.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
