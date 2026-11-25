// Review helper: node packs/_tools/crop.mjs <preview-id> <page> <width> <y> <height> <out.png>  (static, scripts off, reduced motion)
import fs from 'node:fs';
import path from 'node:path';
import { PACKS_ROOT } from './gen.mjs';
import { openBrowser } from '../../themes/lib/browser.mjs';
const [id, page, width, y, height, out] = process.argv.slice(2);
const html = fs.readFileSync(path.join(PACKS_ROOT, '.preview', id, `${page}.html`), 'utf8');
const b = await openBrowser();
const ctx = await b.browser.newContext({ viewport: { width: +width, height: 900 }, javaScriptEnabled: false, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.screenshot({ path: out, fullPage: true, clip: { x: 0, y: +y, width: +width, height: +height } });
await b.close();
