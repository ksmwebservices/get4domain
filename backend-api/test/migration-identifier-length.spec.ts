import * as fs from 'fs';
import * as path from 'path';

/** Postgres cuts any identifier to 63 bytes, and Prisma then sees drift. No migration or schema map may name one longer. */
const MAX = 63;
const root = path.join(__dirname, '..', 'prisma');
/** The one older migration that did (fixed by 20261219200000_v3_wave2_index_name_63). Never add to this list. */
const GRANDFATHERED = new Set(['20261219100000_v3_pack_records:g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdAt_idx']);

describe('identifier length (63)', () => {
  it('no migration creates a name longer than 63 characters', () => {
    const bad: string[] = [];
    for (const d of fs.readdirSync(path.join(root, 'migrations'), { withFileTypes: true })) {
      const f = path.join(root, 'migrations', d.name, 'migration.sql');
      if (!d.isDirectory() || !fs.existsSync(f)) continue;
      const sql = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n');
      for (const m of sql.matchAll(/"([A-Za-z0-9_$]+)"/g)) if (Buffer.byteLength(m[1]) > MAX && !GRANDFATHERED.has(`${d.name}:${m[1]}`)) bad.push(`${d.name}: ${m[1]} (${m[1].length})`);
    }
    expect(bad).toEqual([]);
  });
  it('no schema map or name is longer than 63 characters', () => {
    const schema = fs.readFileSync(path.join(root, 'schema.prisma'), 'utf8');
    const bad = [...schema.matchAll(/(?:map|name):\s*"([^"]+)"/g)].filter((m) => Buffer.byteLength(m[1]) > MAX).map((m) => `${m[1]} (${m[1].length})`);
    const maps = [...schema.matchAll(/@@?map\("([^"]+)"\)/g)].filter((m) => Buffer.byteLength(m[1]) > MAX).map((m) => `${m[1]} (${m[1].length})`);
    expect([...bad, ...maps]).toEqual([]);
  });
  it('the drift-fix migration renames to the 63-character name Prisma expects, guarded', () => {
    const sql = fs.readFileSync(path.join(root, 'migrations', '20261219200000_v3_wave2_index_name_63', 'migration.sql'), 'utf8');
    expect(sql).toContain('RENAME TO "g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdA_idx"');
    expect(sql).toMatch(/IF to_regclass[\s\S]*IS NOT NULL[\s\S]*IS NULL/);
    expect('g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdA_idx'.length).toBeLessThanOrEqual(MAX);
  });
});
