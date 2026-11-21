import * as fs from 'fs';
import * as path from 'path';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { scopeArgs } from '../src/common/tenant/scope-args';
import { findLegacyUse } from './support/legacy-scan';

/** S54.9 (static part): the site module obeys decision D1, reads the legacy site document only through its port, keeps the SEO and mapping code pure, and is tenant scoped. */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const files = tsFiles(path.join(src, 'site-publish'));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('site publish code and the legacy world (decision D1)', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(20); });

  it('no file under src/site-publish imports or queries a legacy billing, BOS, commercial, add-on, module or registry table or constant', () => {
    const offenders = files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((hit) => `${rel(f)}: ${hit}`));
    expect(offenders).toEqual([]);
  });

  it('the legacy site document (VendorCMS) and the vendor items are touched ONLY by the content source, and only to read', () => {
    const users = files.filter((f) => /\.(vendorCMS|vendorProduct)\b|site-doc\//.test(code(f))).map(rel);
    expect(users).toEqual(['site-publish/content/content-source.ts']);
    const c = code(files.find((f) => rel(f) === 'site-publish/content/content-source.ts')!);
    expect(c).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
    expect(c).not.toMatch(/\$executeRaw|\$queryRaw/);
  });

  it('the site module never imports the legacy site renderer, the frontend, or the legacy theme upload code', () => {
    const bad = files.filter((f) => /get4domain_mvp|engine\/|site-doc\/(site-doc|starter|packs|theme-vendor|site-refresh)|themes\/(core|theme-catalog)/.test(code(f))).map(rel);
    expect(bad).toEqual([]);
  });
});

describe('purity of the SEO layer and the mapping (no clock, no randomness, no network, no database, no file system)', () => {
  const pure = ['seo/seo-text.ts', 'seo/page-seo.ts', 'seo/indexing-rule.ts', 'seo/site-files.ts', 'content/content-adapter.ts', 'content/theme-resolution.ts'];
  it.each(pure.map((p) => [p]))('%s', (p) => {
    const c = code(path.join(src, 'site-publish', p));
    expect(c).not.toMatch(/Date\.now|new Date\(|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|XMLHttpRequest|from 'fs'|require\('fs'\)|prisma|PrismaService/);
  });
});

describe('tenant scope of the site tables', () => {
  const opts = { vendorId: 'A', vendorModels: VENDOR_SCOPED_MODELS, sharedModels: new Set<string>() };
  it('settings, publications, pages and events carry a vendorId and are tenant-scoped', () => {
    for (const m of ['V3SiteSettings', 'V3SitePublication', 'V3SitePublicationPage', 'V3SiteEvent']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true);
  });
  it('a scoped read is confined to the caller; a cross-vendor read or write is refused', () => {
    expect(scopeArgs('V3SitePublication', 'findMany', {}, opts)).toEqual({ where: { vendorId: 'A' } });
    expect(scopeArgs('V3SitePublicationPage', 'findMany', { where: { path: '/' } }, opts)).toEqual({ where: { path: '/', vendorId: 'A' } });
    expect(() => scopeArgs('V3SiteEvent', 'findMany', { where: { vendorId: 'B' } }, opts)).toThrow();
    expect(() => scopeArgs('V3SiteSettings', 'create', { data: { vendorId: 'B' } }, opts)).toThrow();
  });
});

describe('the staging cleanup', () => {
  const cleanup = fs.readFileSync(path.resolve(__dirname, '../scripts/staging/test-tenant-cleanup.js'), 'utf8');
  it('removes the draft site document and the audit rows; the four site tables go with the vendor (their foreign keys cascade)', () => {
    expect(cleanup).toContain('prisma.vendorCMS.');
    expect(cleanup).toContain('prisma.v3AuditLog.');
    const migration = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).find((d) => /_v3_site_publish$/.test(d))!;
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
    for (const t of ['g4d_site_settings', 'g4d_site_publications', 'g4d_site_publication_pages', 'g4d_site_events']) expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_vendorId_fkey"[^;]*ON DELETE CASCADE`));
  });
});
