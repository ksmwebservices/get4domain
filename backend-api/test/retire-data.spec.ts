import * as fs from 'fs';
import * as path from 'path';

/**
 * Slice 5.25 keeps all data: retiring a module is a route answer decided by an entitlement, never a table change. Proved statically: the retire module has no database access and no write or delete
 * call, and none of the Batch 13 migrations drops, truncates, renames or deletes anything.
 */
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const strip = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('retiring modules keeps their data', () => {
  const files = walk(path.resolve(__dirname, '../src/v3-retire')).filter((f) => f.endsWith('.ts'));
  it('there is code to scan', () => { expect(files.length).toBeGreaterThanOrEqual(2); });
  it('the retire module imports no database client and makes no write, delete or raw query', () => {
    for (const f of files) expect([path.basename(f), strip(fs.readFileSync(f, 'utf8')).match(/prisma|PrismaService|\$queryRaw|\$executeRaw|\.(create|update|updateMany|upsert|delete|deleteMany)\(/i)]).toEqual([path.basename(f), null]);
  });
  it('no Batch 13 migration drops, truncates, renames or deletes', () => {
    const dir = path.resolve(__dirname, '../prisma/migrations');
    const ours = fs.readdirSync(dir).filter((d) => /^2026120[89]|^202612(1\d)/.test(d) && /_v3_(customers|accounts|jobs|appointments|store)$/.test(d));
    expect(ours).toHaveLength(5);
    for (const d of ours) expect([d, fs.readFileSync(path.join(dir, d, 'migration.sql'), 'utf8').match(/\b(DROP|TRUNCATE|DELETE\s+FROM|RENAME|ALTER\s+TABLE\s+"[^"]+"\s+DROP)\b/i)]).toEqual([d, null]);
  });
});
