import * as fs from 'fs';
import * as path from 'path';
import { REQUIRED_LIVE_ENV } from '../src/common/startup-check';

/** Job L2: .env.live.example lists every variable name the API reads, one comment each, and holds no value. */
const root = path.resolve(__dirname, '..');
const example = fs.readFileSync(path.join(root, '.env.live.example'), 'utf8').replace(/\r\n/g, '\n').split('\n');

const walk = (d: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (p.endsWith('.ts') && !p.endsWith('.spec.ts')) out.push(p); }
  return out;
};
/** The names the code reads: process.env.X, env.X, this.env.X, env['X'], envFallback: 'X', the integer readers, and the storage key table. */
function namesRead(): Set<string> {
  const names = new Set<string>(['DATABASE_URL', 'DIRECT_URL']);   // read by Prisma (schema.prisma)
  for (const f of walk(path.join(root, 'src'))) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\b(?:process\.env|this\.env|env|e)\.([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g)) names.add(m[1]);
    for (const m of s.matchAll(/\benv\[\s*'([A-Z][A-Z0-9_]+)'\s*\]/g)) names.add(m[1]);
    for (const m of s.matchAll(/envFallback:\s*'([A-Z0-9_]+)'/g)) names.add(m[1]);
    for (const m of s.matchAll(/\b(?:positive|intFromEnv)\(\s*'([A-Z][A-Z0-9_]+)'/g)) names.add(m[1]);
    if (f.endsWith(path.join('v3-storage', 'core', 'storage-core.ts'))) for (const m of s.matchAll(/'(STORAGE_(?:PUBLIC|PRIVATE)_[A-Z_]+)'/g)) names.add(m[1]);
  }
  return names;
}
const listed = new Map<string, { active: boolean; line: number }>();
example.forEach((l, i) => { const m = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(l); if (m) listed.set(m[2], { active: !m[1], line: i }); });

describe('.env.live.example', () => {
  it('lists every environment variable name the API reads (PRICE_* fallbacks excepted: prices are set in the admin app)', () => {
    const missing = [...namesRead()].filter((n) => !/^PRICE_/.test(n) && !listed.has(n)).sort();
    expect(missing).toEqual([]);
  });
  it('has the names the live API refuses to start without as active lines, and nothing else active but the three fixed ones', () => {
    for (const n of REQUIRED_LIVE_ENV) expect([n, listed.get(n)?.active]).toEqual([n, true]);
    const active = [...listed.entries()].filter(([, v]) => v.active).map(([k]) => k);
    expect(active.filter((n) => !(REQUIRED_LIVE_ENV as readonly string[]).includes(n)).sort()).toEqual(['NODE_ENV', 'PORT', 'V3_LIVE']);
  });
  it('holds no value: every line is NAME= with nothing after it, except NODE_ENV, V3_LIVE and PORT', () => {
    for (const l of example) {
      const m = /^(?:#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(l); if (!m) continue;
      if (['NODE_ENV', 'V3_LIVE', 'PORT'].includes(m[1])) continue;
      expect([m[1], m[2]]).toEqual([m[1], '']);
    }
    expect(example.join('\n')).not.toMatch(/get4domain\.(com|in)|https?:\/\/[a-z0-9]/i);
  });
  it('has a one-line comment above every name', () => {
    for (const [name, v] of listed) {
      if (name === 'V3_LIVE' || name === 'NODE_ENV') continue;
      expect([name, /^#/.test(example[v.line - 1] ?? '') && !/^#\s*[A-Z][A-Z0-9_]*=/.test(example[v.line - 1])]).toEqual([name, true]);
    }
  });
  it('is not ignored by git, and the real file is', () => {
    const ignore = fs.readFileSync(path.resolve(root, '..', '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env\.live$/m); expect(ignore).not.toMatch(/\.env\.live\.example/);
  });
});
