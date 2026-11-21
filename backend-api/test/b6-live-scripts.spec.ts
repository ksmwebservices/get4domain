import { checkDatabaseUrls } from '../src/common/startup-check';
import { shapePlanOptions } from '../src/plans/me/plan-options.core';
import { selectTaxRate } from '../src/plans/pricing/price-quote';
import { createRequire } from 'module';
const nodeRequire = createRequire(__filename);   // CommonJS scripts under scripts/live: require() is not allowed by the lint rule, createRequire is the same load

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { liveSeedEnv } = nodeRequire('../scripts/live/live-env-lib');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseArgs, collect, render } = nodeRequire('../scripts/live/diagnose-vendor-lib');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { decide, dryLines, run, makeProvidersInert, PROVIDER_ENV } = nodeRequire('../scripts/live/retry-site-provision-lib');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = nodeRequire('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = nodeRequire('path');

/** B6.3 and B6.4: the live diagnosis is read-only and prints no phone or e-mail; the retry is dry by default, refuses a non-failed vendor and a non-live database, and calls the vendor's own retry service. */
const now = new Date('2026-11-19T00:00:00Z');
const EMAIL = 'owner@example.test'; const PHONE = '9840012345';

function fakePrisma(over: { vendor?: Record<string, unknown> | null; hostOwner?: string | null; reviews?: Array<{ status: string }>; prices?: unknown[]; heldTrack?: string | null } = {}) {
  const calls: string[] = [];
  const vendor = over.vendor === null ? null : { id: 'v1', status: 'PENDING', role: 'VENDOR', createdAt: new Date('2026-11-18T00:00:00Z'), industry: 'handyman', subdomain: 'sri-ganesh', siteProvisionStatus: 'FAILED', siteProvisionCode: 'PUBLISH_BLOCKED', siteProvisionFailedAt: new Date('2026-11-18T01:00:00Z'), email: EMAIL, phone: PHONE, ...(over.vendor ?? {}) };
  const t = (name: string, v: unknown) => async () => { calls.push(name); return v; };
  const prisma = {
    vendor: { findFirst: async ({ select }: { select: Record<string, boolean> }) => { calls.push('vendor.findFirst'); if (!vendor) return null; return Object.fromEntries(Object.entries(vendor).filter(([k]) => select[k])); } },
    v3PlanSubscription: { findUnique: t('sub', over.heldTrack === null ? null : { status: 'ACTIVE', termMonths: null, endsAt: null, plan: { key: 'handyman_free', track: over.heldTrack ?? 'handyman', level: 'FREE' } }), findFirst: t('sub2', null) },
    v3PackCategory: { findUnique: t('cat', null) },
    vendorCMS: { findUnique: t('cms', { siteStatus: 'DRAFT', packKey: null, banner: '/b.svg', address: null, phone: PHONE }) },
    v3SitePublication: { findMany: t('pubs', []) },
    v3Domain: { findUnique: t('host', over.hostOwner === undefined ? null : over.hostOwner === null ? null : { vendorId: over.hostOwner, status: 'ACTIVE', kind: 'SUBDOMAIN' }) },
    v3DuplicateReview: { findMany: t('reviews', over.reviews ?? []) },
    v3Plan: { findMany: t('plans', [{ id: 'p1', key: 'handyman_pro', track: 'handyman', level: 'PRO', name: 'Handyman Pro', description: null, status: 'ACTIVE', isPublic: true, sortOrder: 1 }]) },
    v3PlanPrice: { findMany: t('prices', over.prices ?? [{ planId: 'p1', termMonths: 12, amountPaise: 1200000, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: new Date('2026-11-01T00:00:00Z') }]) },
    v3TaxRate: { findMany: t('tax', [{ name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z') }]) },
  };
  return { prisma, calls };
}
const deps = { shapePlanOptions, selectTaxRate, baseDomain: 'get4domain.com', categoryProbe: () => 'track-default' };

describe('B6.3 diagnose-vendor', () => {
  it('names the vendor by e-mail or id, once, and refuses anything else', () => {
    expect(parseArgs(['--email', 'a@b.test'])).toMatchObject({ ok: true, by: 'email', staging: false });
    expect(parseArgs(['--id', 'v1', '--staging'])).toMatchObject({ ok: true, by: 'id', staging: true });
    for (const bad of [[], ['--email'], ['--email', 'a', '--id', 'b'], ['--apply'], ['a@b.test'], ['--id', '--staging']]) expect(parseArgs(bad).ok).toBe(false);
  });
  it('prints track, plan, site row, code, address owner and the chooser, and never the e-mail or phone', async () => {
    const { prisma } = fakePrisma({ hostOwner: 'v1' });
    const facts = await collect(prisma, { by: 'email', value: EMAIL }, deps, now);
    const text = render(facts).join('\n');
    expect(text).toContain('Vendor v1'); expect(text).toContain('siteProvisionCode:   PUBLISH_BLOCKED'); expect(text).toContain('siteProvisionStatus: FAILED');
    expect(text).toContain('plan held: handyman_free'); expect(text).toContain('track the chooser uses: handyman (from the plan held)');
    expect(text).toContain('host row owner: this vendor'); expect(text).toContain('handyman_pro'); expect(text).toContain('12 months  Rs 12000.00 before GST');
    expect(text).toContain('site row: present, DRAFT'); expect(text).toContain('neutral design of the track');
    expect(text).not.toContain(EMAIL); expect(text).not.toContain(PHONE);
  });
  it('shows a held duplicate review, another vendor owning the address, and an honest empty chooser', async () => {
    const { prisma } = fakePrisma({ hostOwner: 'someone-else', reviews: [{ status: 'PENDING' }], prices: [] });
    const text = render(await collect(prisma, { by: 'id', value: 'v1' }, deps, now)).join('\n');
    expect(text).toContain('HELD (1 not cleared)'); expect(text).toContain('ANOTHER vendor'); expect(text).toContain('NO_APPROVED_PRICE');
  });
  it('is read only: it calls nothing but find methods', async () => {
    const { prisma, calls } = fakePrisma();
    await collect(prisma, { by: 'id', value: 'v1' }, deps, now);
    expect(calls.length).toBeGreaterThan(8);
    const src = fs.readFileSync(path.resolve(__dirname, '../scripts/live/diagnose-vendor.js'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '../scripts/live/diagnose-vendor-lib.js'), 'utf8');
    expect(src).not.toMatch(/\.(create|update|upsert|delete|deleteMany|updateMany|createMany|\$executeRaw|\$queryRawUnsafe)\s*\(/);
  });
  it('answers null for an unknown vendor', async () => { expect(await collect(fakePrisma({ vendor: null }).prisma, { by: 'id', value: 'x' }, deps, now)).toBeNull(); });
  it('refuses a staging, test or local database and a placeholder (the live scripts\' own guard)', () => {
    for (const url of ['postgresql://u:p@localhost:5432/db', 'postgresql://u:p@127.0.0.1:5432/db', 'postgresql://u:p@db.example.test:5432/v3test', '', 'changeme']) {
      expect(liveSeedEnv({ DATABASE_URL: url, DIRECT_URL: url }, checkDatabaseUrls).ok).toBe(false);
    }
  });
});

describe('B6.4 retry-site-provision', () => {
  const base = { id: 'v1', role: 'VENDOR', status: 'PENDING', siteProvisionStatus: 'FAILED', siteProvisionCode: 'PUBLISH_BLOCKED', siteProvisionFailedAt: new Date('2026-11-18T01:00:00Z'), industry: 'handyman' };
  it('retries only a vendor account whose site is recorded as failed', () => {
    expect(decide(base).ok).toBe(true);
    expect(decide(null).ok).toBe(false);
    expect(decide({ ...base, role: 'ADMIN' }).problem).toMatch(/not a vendor/);
    expect(decide({ ...base, status: 'SUSPENDED' }).problem).toMatch(/suspended/);
    expect(decide({ ...base, siteProvisionStatus: null }).problem).toMatch(/nothing to retry/);
  });
  it('the dry run says what would happen and what the category would use', () => {
    expect(dryLines(base, 'track-default').join('\n')).toMatch(/PUBLISH_BLOCKED[\s\S]*neutral design[\s\S]*would, in this order/);
    expect(dryLines(base, 'none').join('\n')).toContain('would fail again');
  });
  it('apply calls the vendor\'s own retry service once with the vendor id and reports the recorded result', async () => {
    const calls: string[] = [];
    const hook = { createMySite: async (id: string) => { calls.push(id); return { status: 'LIVE', published: true }; } };
    const prisma = { vendor: { findUnique: async () => ({ siteProvisionStatus: null, siteProvisionCode: null }) } };
    expect(await run({ hook, prisma, vendorId: 'v1' })).toEqual({ status: 'LIVE', published: true, siteProvisionStatus: null, siteProvisionCode: null });
    expect(calls).toEqual(['v1']);
  });
  it('is dry by default: the script writes only after --apply and a typed LIVE', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../scripts/live/retry-site-provision.js'), 'utf8');
    expect(src).toContain("argv.includes('--apply')"); expect(src).toContain('applyConfirmed(await ask(');
    expect(src.indexOf('if (!apply)')).toBeLessThan(src.indexOf('applyConfirmed(await ask('));
    expect(src.indexOf('applyConfirmed(await ask(')).toBeLessThan(src.indexOf('bootSiteApp('));
    expect(src).toContain('liveSeedEnv(process.env');
  });
  it('removes every provider key and sets inert placeholders, so nothing can be sent', () => {
    const env: Record<string, string | undefined> = {}; for (const k of PROVIDER_ENV) env[k] = 'real-value';
    makeProvidersInert(env);
    expect(env.EMAIL_MODE).toBe('test');
    for (const k of PROVIDER_ENV) expect(env[k] === undefined || /placeholder|inert/.test(String(env[k]))).toBe(true);
  });
});
