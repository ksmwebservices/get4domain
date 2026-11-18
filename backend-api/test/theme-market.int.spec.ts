// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/plans/admin/audit.service';
import { PrismaThemeMarketStore } from '../src/v3-theme-market/prisma-theme-market.store';
import { NewTheme } from '../src/v3-theme-market/theme-market.store';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * TM1 M2 on STAFF-ONLY staging: the theme package table (RLS, the database's own checks), the Prisma store (bytes round trip, unique key and version, filters on array columns, conditional moves, the audit row
 * in the same transaction) and the cascade for a private theme. Synthetic data only: rows are keyed `tm1-int-<run>` and removed here; vendors are V3TEST vendors removed by the cleanup.
 * NOT RUN in the session that wrote it unless the status file says so; run `npx.cmd jest --ci --runInBand test/theme-market.int.spec.ts --selectProjects int`.
 */
jest.setTimeout(240_000);
const stamp = RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'run';
const KEY = (n: string): string => `tm1-int-${stamp}-${n}`;
const ZIP = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.from('synthetic bytes for the store test, not a real package ', 'utf8'), Buffer.alloc(300, 7)]);
const by = { type: 'STAFF' as const, id: 'int-staff', ip: null };

const theme = (key: string, version: number, over: Partial<NewTheme> = {}): NewTheme => ({
  key, version, name: `Int ${key}`, description: null, tier: 'Standard', status: 'DRAFT', visibility: 'PUBLIC', privateVendorId: null, sourceVendorId: null, starter: false, licence: 'Built by the team.',
  tracks: ['professional'], packs: ['CLINIC'], addons: ['PHARMACY_COUNTER'], capabilities: ['LAB'], tags: ['clinic-plus-pharmacy'], catalogueCategories: [], kitCategories: ['doctor-clinic'],
  manifest: { id: key, version }, contentHash: createHash('sha256').update(`${key}${version}`).digest('hex'), sizeBytes: ZIP.length, fileCount: 3,
  consentObtained: null, consentNote: null, createdByType: 'STAFF', createdById: 'int-staff', bytes: ZIP, ...over,
});

describe('theme market on staging', () => {
  let prisma: PrismaClient; let store: PrismaThemeMarketStore; let A: { vendorId: string }; let C: { vendorId: string };
  const audit = (action: string) => ({ actor: by, action, before: null, after: { ok: true } });

  beforeAll(async () => {
    prisma = newPrisma(); store = new PrismaThemeMarketStore(prisma as unknown as PrismaService, new AuditService(prisma as unknown as PrismaService));
    A = await seedBareVendor(prisma, 'tma', RUN_ID); C = await seedBareVendor(prisma, 'tmc', RUN_ID);
  }, 240_000);
  afterAll(async () => {
    await runCleanup([
      async () => { const rows = await prisma.v3ThemeMarketPackage.findMany({ where: { key: { startsWith: `tm1-int-${stamp}` } }, select: { id: true } }); await prisma.v3AuditLog.deleteMany({ where: { entityType: 'theme', entityId: { in: rows.map((r) => r.id) } } }).catch(() => undefined); await prisma.v3ThemeMarketPackage.deleteMany({ where: { key: { startsWith: `tm1-int-${stamp}` } } }); },
      () => cleanupTenants(prisma, RUN_ID).then(() => undefined), () => prisma?.$disconnect(),
    ]);
  }, 240_000);

  it('row level security is ON and the table carries no policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'g4d_theme_market_packages'`;
    expect(rows).toHaveLength(1); expect(rows[0].relrowsecurity).toBe(true);
    expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = 'g4d_theme_market_packages'`).toEqual([]);
  });

  it('stores the bytes exactly, writes the audit row with the change, and refuses a second row for the same key and version', async () => {
    const created = await store.create(theme(KEY('a'), 1), audit('theme.upload'));
    expect(created).not.toBeNull(); expect(created!.status).toBe('DRAFT'); expect((created as unknown as { bytes?: unknown }).bytes).toBeUndefined();
    const full = await store.findWithBytes(created!.id); expect(full!.bytes.equals(ZIP)).toBe(true); expect(createHash('sha256').update(full!.bytes).digest('hex')).toBe(createHash('sha256').update(ZIP).digest('hex'));
    const a = await prisma.v3AuditLog.findMany({ where: { entityType: 'theme', entityId: created!.id } }); expect(a.map((x) => x.action)).toEqual(['theme.upload']);
    expect(await store.create(theme(KEY('a'), 1), audit('theme.upload'))).toBeNull();
    expect(await prisma.v3AuditLog.count({ where: { entityType: 'theme', entityId: created!.id } })).toBe(1);   // the refused one wrote nothing
    expect(await store.maxVersion(KEY('a'))).toBe(1);
  });

  it('filters on the array columns and on status, and lists without the bytes', async () => {
    await store.create(theme(KEY('b'), 1, { packs: ['LAB', 'CLINIC'], tags: [], addons: [], capabilities: [] }), audit('theme.upload'));
    const clinic = await store.list({ pack: 'CLINIC', key: KEY('a') }, 0, 10); expect(clinic.items.map((t) => t.key)).toEqual([KEY('a')]);
    const lab = await store.list({ pack: 'LAB', q: `tm1-int-${stamp}` }, 0, 10); expect(lab.items.map((t) => t.key)).toEqual([KEY('b')]);
    expect((await store.list({ tag: 'clinic-plus-pharmacy', q: `tm1-int-${stamp}` }, 0, 10)).items.map((t) => t.key)).toEqual([KEY('a')]);
    expect((await store.list({ addon: 'PHARMACY_COUNTER', capability: 'LAB', q: `tm1-int-${stamp}` }, 0, 10)).total).toBe(1);
    expect((await store.list({ status: 'PUBLISHED', q: `tm1-int-${stamp}` }, 0, 10)).total).toBe(0);
    for (const t of clinic.items) expect((t as unknown as { bytes?: unknown }).bytes).toBeUndefined();
  });

  it('a move happens only from an allowed status, with its audit row; publishing v2 archives v1 of the key in the same step', async () => {
    const v1 = (await store.create(theme(KEY('c'), 1), audit('theme.upload')))!; const v2 = (await store.create(theme(KEY('c'), 2), audit('theme.upload')))!;
    const now = new Date();
    expect(await store.transition(v1.id, ['REVIEW'], { status: 'PUBLISHED', publishedAt: now }, audit('theme.publish'))).toBeNull();   // it is a DRAFT
    expect((await store.transition(v1.id, ['DRAFT'], { status: 'REVIEW', submittedAt: now }, audit('theme.submit')))!.status).toBe('REVIEW');
    expect((await store.transition(v1.id, ['REVIEW'], { status: 'PUBLISHED', publishedAt: now, publishedById: 'int-staff' }, audit('theme.publish'), { key: KEY('c'), below: 1 }))!.status).toBe('PUBLISHED');
    await store.transition(v2.id, ['DRAFT'], { status: 'REVIEW', submittedAt: now }, audit('theme.submit'));
    await store.transition(v2.id, ['REVIEW'], { status: 'PUBLISHED', publishedAt: now }, audit('theme.publish'), { key: KEY('c'), below: 2 });
    expect((await store.find(v1.id))!.status).toBe('ARCHIVED'); expect((await store.find(v2.id))!.status).toBe('PUBLISHED');
    const servable = (await store.loadServable()).filter((t) => t.key === KEY('c')); expect(servable.map((t) => [t.version, t.status])).toEqual([[2, 'PUBLISHED'], [1, 'ARCHIVED']]); expect(servable[0].bytes.equals(ZIP)).toBe(true);
    const actions = (await prisma.v3AuditLog.findMany({ where: { entityType: 'theme', entityId: v1.id }, orderBy: { at: 'asc' } })).map((x) => x.action); expect(actions).toEqual(['theme.upload', 'theme.submit', 'theme.publish', 'theme.archive']);
  });

  it('the database enforces its own rules: closed status and visibility, the private rule, the consent rule, the key format and the size', async () => {
    const bad = async (over: Partial<NewTheme>, n: string) => { await expect(store.create(theme(KEY(n), 1, over), audit('theme.upload'))).rejects.toBeDefined(); };
    await bad({ status: 'LIVE' as never }, 'x1'); await bad({ visibility: 'SECRET' as never }, 'x2'); await bad({ tier: 'Gold' }, 'x3');
    await bad({ visibility: 'PRIVATE', privateVendorId: null }, 'x4');                          // a private theme names its business
    await bad({ visibility: 'PUBLIC', privateVendorId: A.vendorId }, 'x5');                     // a public theme names none
    await bad({ packs: [] }, 'x6'); await bad({ key: 'Bad Key!' }, 'x7'); await bad({ sizeBytes: 5 * 1024 * 1024 + 1 }, 'x8');
    // the published stamp travels with the status
    await bad({ status: 'PUBLISHED' }, 'x9');
    // consent: a theme made for a customer cannot be PUBLISHED to the marketplace without the recorded consent. Written straight to the table, with the published stamp set, so ONLY the consent rule can refuse it.
    const base = (n: string, over: Record<string, unknown>) => ({ ...theme(KEY(n), 1), manifestJson: {}, manifest: undefined, bytes: new Uint8Array(ZIP), status: 'PUBLISHED', publishedAt: new Date(), ...over }) as never;
    const raw = (n: string, over: Record<string, unknown>) => { const { manifest: _m, ...rest } = base(n, over) as Record<string, unknown>; void _m; return prisma.v3ThemeMarketPackage.create({ data: rest as never }); };
    await expect(raw('c1', { sourceVendorId: A.vendorId, consentObtained: null })).rejects.toThrow(/consent_check/);
    await expect(raw('c2', { sourceVendorId: A.vendorId, consentObtained: false })).rejects.toThrow(/consent_check/);
    await expect(raw('c3', { sourceVendorId: A.vendorId, consentObtained: true })).resolves.toBeDefined();   // consent recorded: allowed
    await expect(raw('c4', { sourceVendorId: null, consentObtained: null })).resolves.toBeDefined();           // made for the marketplace: no customer, no consent needed
    await expect(raw('c5', { visibility: 'PRIVATE', privateVendorId: A.vendorId, sourceVendorId: A.vendorId, consentObtained: null })).resolves.toBeDefined();   // private: it never leaves the one business
  });

  it('a private theme belongs to one business and goes with it (cascade); the facts used to keep a package content-free are readable', async () => {
    const p = (await store.create(theme(KEY('priv'), 1, { visibility: 'PRIVATE', privateVendorId: C.vendorId, sourceVendorId: C.vendorId }), audit('theme.upload')))!;
    expect((await store.list({ privateVendorId: C.vendorId }, 0, 10)).items.map((t) => t.id)).toEqual([p.id]); expect((await store.list({ privateVendorId: A.vendorId, key: KEY('priv') }, 0, 10)).total).toBe(0);   // another business never sees it
    const facts = await store.vendorFacts(C.vendorId); expect(facts).toMatchObject({ mediaHashes: [] }); expect(typeof facts!.name).toBe('string');
    expect(await store.vendorExists(C.vendorId)).toBe(true); expect(await store.vendorExists('no-such-vendor')).toBe(false); expect(await store.vendorFacts('no-such-vendor')).toBeNull();
    await prisma.vendor.delete({ where: { id: C.vendorId } });
    expect(await store.find(p.id)).toBeNull();
  });
});
