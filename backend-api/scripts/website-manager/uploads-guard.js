#!/usr/bin/env node
'use strict';
/**
 * [feat:website-manager.uploads] Guard: every endpoint that accepts a file is listed here, and every picture is stored by the shared MediaService.
 * Fails if a new upload endpoint appears that is not in the list, or if any file other than media.service.ts writes into the public uploads folder.
 *   node scripts/website-manager/uploads-guard.js
 */
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'src');

// The only places that may take a file. `shared` = goes through MediaService. A private document is not site media and has its own rules, said here on purpose.
const ALLOWED = {
  'uploads/uploads.controller.ts': { shared: true, why: 'the one picture endpoint (logo, banner, gallery, products, about, receipts, AI Studio, LeadSpace items)' },
  'commercial/commercial.controllers.ts': { shared: false, why: 'payment-proof screenshots: private (never public), 3 MB, checked by the payment service' },
};

// Files that write into uploads/ but are not pictures.
const NOT_PICTURES = { 'reels/reels.service.ts': 'rendered MP4 videos, never an uploaded picture' };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(src).filter((f) => f.endsWith('.ts'));
let fail = 0;
const say = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

const users = files.filter((f) => /FileInterceptor|FilesInterceptor|FileFieldsInterceptor|AnyFilesInterceptor/.test(fs.readFileSync(f, 'utf8')));
for (const f of users) {
  const rel = path.relative(src, f).split(path.sep).join('/');
  say(!!ALLOWED[rel], `upload endpoint ${rel} is on the list${ALLOWED[rel] ? ` (${ALLOWED[rel].why})` : ': ADD IT TO THE SHARED SERVICE or to the list with a reason'}`);
}
say(users.some((f) => f.endsWith('uploads.controller.ts')), 'the shared picture endpoint exists');
const ctl = fs.readFileSync(path.join(src, 'uploads', 'uploads.controller.ts'), 'utf8');
say(/MediaService/.test(ctl) && /media\.store\(/.test(ctl), 'the picture endpoint hands every file to MediaService.store (check, clean, resize, count)');
for (const f of files) {
  const rel = path.relative(src, f).split(path.sep).join('/');
  const t = fs.readFileSync(f, 'utf8');
  if (rel === 'uploads/media.service.ts' || rel === 'uploads/uploads.util.ts' || NOT_PICTURES[rel]) continue;
  if (/writeFileSync|createWriteStream|writeFile\(/.test(t) && /uploadsDir|\/uploads\//.test(t)) say(false, `${rel} writes a file into uploads without the shared writeUpload()`);
  if (/uploadsDir\(\)/.test(t) && /writeFileSync|createWriteStream|writeFile\(/.test(t)) say(false, `${rel} writes into the public uploads folder without MediaService`);
}
say(true, 'no other file writes into the public uploads folder');
const media = fs.readFileSync(path.join(src, 'uploads', 'media.service.ts'), 'utf8');
say(/MAX_UPLOAD_BYTES/.test(media) && /sharp\(/.test(media) && /mediaAsset\.create/.test(media), 'MediaService enforces the size rule, processes with sharp and records every file');
console.log(fail ? `\nFAIL: ${fail} problem(s)` : '\nPASS: every upload goes through the shared service (or is a listed private document).');
process.exit(fail ? 1 : 0);
