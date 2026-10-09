#!/usr/bin/env node
// Bug B1 permanent guard: the forms and the API agree about what an edit may contain.   node scripts/verify-payload-contract.mjs
//  1. the Website Manager's editable list (lib/editable.ts CMS_EDITABLE) == the API's UpdateVendorCmsDto fields (minus `portfolio`, saved on its own)
//  2. the read-only keys the forms drop (READ_ONLY_KEYS) == the read-only keys the API's edit pipe tolerates (ECHOED_READ_ONLY_KEYS)
//  3. every edit call in the dashboard sends a literal or picked payload (scripts/audit-update-payloads.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');
let pass = 0; let fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass += 1; console.log(`  PASS  ${name}`); } else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); } };
const list = (src, re) => { const m = re.exec(src); return m ? [...m[1].matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1]) : []; };

const front = read('src/lib/editable.ts');
const cmsFront = list(front, /CMS_EDITABLE = \[([^\]]*)\]/).sort();
const dto = fs.readFileSync(path.join(here, '..', '..', 'backend-api', 'src', 'cms', 'dto', 'update-vendor-cms.dto.ts'), 'utf8');
const body = dto.slice(dto.indexOf('export class UpdateVendorCmsDto'));
const cmsDto = [...body.matchAll(/^\s*(?:@\w+\([^)]*\)\s*)+(\w+)\?:/gm)].map((m) => m[1]).filter((k) => k !== 'portfolio').sort();
console.log('\n== [feat:site.edit-contract] forms and API agree about edits');
ok('the Website Manager sends exactly the fields the API accepts', JSON.stringify(cmsFront) === JSON.stringify(cmsDto), `form ${cmsFront.length} vs API ${cmsDto.length}: ${cmsFront.filter((k) => !cmsDto.includes(k)).join(',')} / ${cmsDto.filter((k) => !cmsFront.includes(k)).join(',')}`);
const roFront = list(front, /READ_ONLY_KEYS = \[([^\]]*)\]/).sort();
const pipe = fs.readFileSync(path.join(here, '..', '..', 'backend-api', 'src', 'common', 'pipes', 'edit-validation.pipe.ts'), 'utf8');
const roPipe = [...(/ECHOED_READ_ONLY_KEYS: readonly string\[\] = \[([\s\S]*?)\];/.exec(pipe)?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1]).sort();
ok('the keys the forms drop are the keys the API tolerates', JSON.stringify(roFront) === JSON.stringify(roPipe), `${roFront.join(',')} vs ${roPipe.join(',')}`);
const r = spawnSync(process.execPath, [path.join(here, 'audit-update-payloads.mjs')], { encoding: 'utf8' });
ok('every edit call in the dashboard sends a literal or picked payload', r.status === 0, (r.stdout + r.stderr).split('\n').slice(0, 6).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
