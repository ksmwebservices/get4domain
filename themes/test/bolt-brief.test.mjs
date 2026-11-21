// C2.5 BOLT_BRIEF.md: generated from the code, so it cannot drift. The committed file must equal the generator's output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boltBrief, SLOT_NOTES, RULE_HELP, MOTION_CLASSES } from '../lib/bolt-brief.mjs';
import { BINDINGS, REPEATERS, SLOTS, TOKENS, MOTION_TOKENS, APPROVED_FONTS, LIMITS, IMAGE_BUDGET, FREE_LIMITS, REQUIRED_SLOTS_ALL, ENTITLEMENT_KEYS, MOTION_INTENSITIES, DATA_ATTRIBUTES, PAGE_TEMPLATES } from '../lib/vocabulary.mjs';
import { RULE_IDS } from '../lib/lint.mjs';
import { FAMILIES } from '../lib/categories.mjs';
import { boltKitFiles } from '../lib/bolt-kit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brief = boltBrief();

test('the committed themes/BOLT_BRIEF.md is exactly what the generator writes (no drift)', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'BOLT_BRIEF.md'), 'utf8'), brief);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'cli.mjs'), 'bolt-brief', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('the zip carries the same brief', () => {
  assert.equal(boltKitFiles()['BOLT_BRIEF.md'].toString('utf8'), brief);
});

test('every scalar binding, every list and every list field is in the brief', () => {
  for (const b of BINDINGS) assert.ok(brief.includes(`{{${b}}}`), b);
  for (const [name, r] of Object.entries(REPEATERS)) {
    assert.ok(brief.includes(`data-g4d-each="${name}"`), name);
    for (const f of r.fields) assert.ok(brief.includes(`{{${r.as}.${f}}}`), `${name}: ${r.as}.${f}`);
  }
  for (const a of DATA_ATTRIBUTES) assert.ok(brief.includes(a), a);
  for (const k of ENTITLEMENT_KEYS) assert.ok(brief.includes(`entitlements.${k}`), k);
  assert.match(brief, /data-g4d-if="entitlements\.booking"/);
});

test('every slot tag is there with its attributes, and the required ones are marked', () => {
  assert.deepEqual(Object.keys(SLOT_NOTES).sort(), Object.keys(SLOTS).sort(), 'SLOT_NOTES must describe every slot');
  for (const s of Object.values(SLOTS)) assert.ok(brief.includes(`<${s.tag}`), s.tag);
  assert.match(brief, /<g4d-video limit="3">/);
  assert.match(brief, /<g4d-product-grid limit="12" images="3">/);
  const row = (name) => brief.split('\n').find((l) => l.includes(`<${SLOTS[name].tag}`) && l.startsWith('|'));
  for (const s of REQUIRED_SLOTS_ALL) assert.match(row(s), /\| yes \|/, `${s} is marked required`);
  for (const s of ['video', 'cart', 'booking']) assert.doesNotMatch(row(s), /\| yes \|/, `${s} is optional`);
});

test('tokens, motion tokens, the 12 fonts, the intensities and the wrapper attributes are listed', () => {
  for (const t of [...TOKENS, ...MOTION_TOKENS]) assert.ok(brief.includes(t), t);
  assert.equal(APPROVED_FONTS.length, 12);
  for (const f of APPROVED_FONTS) assert.ok(brief.includes(f), f);
  for (const m of MOTION_INTENSITIES) assert.ok(brief.toLowerCase().includes(m.toLowerCase()), m);
  for (const a of ['lang', 'data-variant', 'data-motion', 'data-hero', 'data-header', 'data-services', 'data-card', 'data-divider', 'data-decor']) assert.ok(brief.includes(a), a);
  for (const p of PAGE_TEMPLATES) assert.ok(brief.includes(`${p}.html`), p);
});

test('the nine variants table matches the categories', () => {
  const ids = [...new Set(Object.values(FAMILIES).map((f) => f.variant.id))];
  assert.equal(ids.length, 9);
  for (const id of ids) assert.ok(brief.includes(`\`${id}\``), id);
  for (const [fam, f] of Object.entries(FAMILIES)) assert.ok(brief.includes(fam) && brief.includes(f.variant.hero), fam);
});

test('every motion kit class is documented with an example, and nothing is documented that the kit does not have', () => {
  const kit = fs.readFileSync(path.join(ROOT, 'shared', 'motion-kit.css'), 'utf8');
  const inKit = new Set([...kit.matchAll(/\.(g4d-[a-z][a-z0-9_-]*)/g)].map((m) => m[1]).filter((c) => c !== 'g4d-theme'));
  const documented = new Set(MOTION_CLASSES.flatMap((m) => m.covers));
  for (const c of inKit) assert.ok(documented.has(c), `kit class ${c} is not documented`);
  for (const c of documented) assert.ok(inKit.has(c), `documented class ${c} is not in the kit`);
  for (const m of MOTION_CLASSES) { assert.ok(brief.includes(m.example), m.cls); assert.ok(m.example.includes(m.cls.split(' ')[0]), `${m.cls}: the example uses the class`); }
});

test('budgets are the real limits', () => {
  assert.ok(brief.includes(`${LIMITS.layoutCssBytes / 1024} KB`));
  assert.ok(brief.includes(`${LIMITS.motionCssBytes / 1024} KB`));
  assert.ok(brief.includes(`${LIMITS.htmlPageBytes / 1024} KB`));
  assert.ok(brief.includes(`${IMAGE_BUDGET.free} pictures`));
  assert.ok(brief.includes(`fewer than ${IMAGE_BUDGET.pro + 1} pictures`));
  assert.ok(brief.includes(`${FREE_LIMITS.services} services`));
  assert.match(brief, /width and height/);
  assert.match(brief, /only the hero/i);
});

test('the forbidden list, the entitlement rules and the deliverable are stated', () => {
  for (const w of ['<script>', '<form>', '<input>', '<iframe>', '<style>', 'outside address', 'onclick', 'hard-coded colour']) assert.ok(brief.includes(w), w);
  assert.match(brief, /any theme may place/i);
  assert.match(brief, /library\/<id>\//);
  assert.match(brief, /no presets/i);
  assert.match(brief, /npm run lint:all/);
  assert.match(brief, /npm run preview/);
});

test('every lint rule has plain help, so the brief lists the common failures with their fixes', () => {
  assert.deepEqual(Object.keys(RULE_HELP).sort(), [...RULE_IDS].sort(), 'RULE_HELP must describe every rule');
  for (const id of RULE_IDS) { assert.ok(brief.includes(`\`${id}\``), id); assert.ok(RULE_HELP[id].fix.length > 10, id); }
});

test('the brief is plain words: no repository paths a designer cannot see', () => {
  assert.doesNotMatch(brief, /backend-api|get4domain_mvp|docs\/v3|C:\\/);
});
