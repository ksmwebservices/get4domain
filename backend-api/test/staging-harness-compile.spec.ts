import 'reflect-metadata';
import { readdirSync, readFileSync } from 'fs';

process.env.EMAIL_MODE = 'test';   // the mailer's capture mode, as in staging-env: no provider key, nothing sent
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_compile_only';   // the existing payments service builds a client in its constructor
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'compile-only-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-compile-only-secret';   // JwtStrategy needs a value to construct; nothing is signed or verified here
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeRazorpay } from './support/fake-razorpay';
import { plansTestModuleMetadata } from './support/plans-test-app';
import { provisioningTestModuleMetadata, ProvisioningTestOptions } from './support/provisioning-test-app';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { EmailModule } from '../src/email/email.module';
import { B3SettingsModule } from '../src/b3-settings/b3-settings.module';
import { DirectoryModule } from '../src/directory/directory.module';
import { RequestsOrdersModule } from '../src/requests-orders/requests-orders.module';
import { SeededSitesModule } from '../src/seeded-sites/seeded-sites.module';
import { SiteLifecycleModule } from '../src/seeded-sites/prisma-site-lifecycle';
import { SiteDomainsModule } from '../src/site-domains/site-domains.module';
import { SitePublishModule } from '../src/site-publish/site-publish.module';
import { TermsModule } from '../src/terms/terms.module';
import { VendorLifecycleModule } from '../src/vendor-lifecycle/vendor-lifecycle.module';
import { SitePublicService } from '../src/site-publish/publish/site-public.service';
import { testAppModuleMetadata } from './support/test-app';

/**
 * The staging suites boot their app through these builders. Staging is not reachable from the build environment, so a provider a service needs but the harness
 * does not supply would only show up as 60 red staging tests. Here every option combination a staging spec uses is COMPILED (dependency injection resolved,
 * nothing initialised, so no connection is made) with the database client faked.
 */
const fakePrisma = new Proxy({}, { get: (_t, k) => (k === 'then' ? undefined : k === 'onModuleInit' || k === 'onModuleDestroy' ? async () => undefined : () => undefined) });

async function compiles(meta: { imports?: unknown[]; controllers?: unknown[]; providers?: unknown[] }): Promise<void> {
  const moduleRef = await Test.createTestingModule(meta as never).overrideProvider(PrismaService).useValue(fakePrisma).compile();
  expect(moduleRef).toBeDefined();
  await moduleRef.close();
}

// Every option set passed to buildProvisioningTestApp by a *.int.spec.ts (a guard test below keeps this list honest).
const OPTION_SETS: Array<[string, ProvisioningTestOptions]> = [
  ['default', {}],
  ['site api', { includeSiteApi: true }],
  ['directory api', { includeDirectoryApi: true }],
  ['ai api', { includeAiApi: true }],
  ['billing', { billing: { fake: new FakeRazorpay() } }],
  ['directory + b3', { includeDirectoryApi: true, b3: true }],
  ['site + directory + b3', { includeSiteApi: true, includeDirectoryApi: true, b3: true }],
  ['every option at once', { includeSiteApi: true, includeDirectoryApi: true, includeAiApi: true, b3: true, billing: { fake: new FakeRazorpay() } }],
  ['b3 alone', { b3: true }],
];

describe('staging harness: the test apps compile without a database', () => {
  it.each(OPTION_SETS)('buildProvisioningTestApp: %s', async (_name, opts) => { await compiles(provisioningTestModuleMetadata(opts)); }, 60000);
  // SitePublicService takes its entitlement engine and theme renderer as OPTIONAL dependencies. If one is silently undefined the stored Pro page is served WITH its forms to a suspended or lapsed vendor.
  it('SitePublicService gets every optional dependency it needs to serve a listing-only page', async () => {
    const moduleRef = await Test.createTestingModule(provisioningTestModuleMetadata({ includeSiteApi: true })).overrideProvider(PrismaService).useValue(fakePrisma).compile();
    const svc = moduleRef.get(SitePublicService) as unknown as Record<string, unknown>;
    expect(svc.ents).toBeDefined(); expect(svc.b3).toBeDefined(); expect(svc.themes).toBeDefined();
    await moduleRef.close();
  }, 60000);
  it('buildPlansTestApp', async () => { await compiles(plansTestModuleMetadata()); }, 60000);
  it('buildTestApp', async () => { await compiles(testAppModuleMetadata()); }, 60000);

  // The real Batch 3 modules, as app.module.ts wires them: a constructor parameter typed as Pick<...> or an interface compiles to Object and needs @Inject.
  it('the production Batch 3 modules resolve together', async () => {
    await compiles({ imports: [PrismaModule, PlansModule, EmailModule, B3SettingsModule, SitePublishModule, SiteDomainsModule, DirectoryModule, VendorLifecycleModule, SiteLifecycleModule, SeededSitesModule, RequestsOrdersModule, TermsModule], controllers: [], providers: [] });
  }, 60000);

  it('every option key a staging spec passes is covered above', () => {
    const used = new Set<string>();
    for (const f of readdirSync(__dirname).filter((n) => n.endsWith('.int.spec.ts'))) {
      const src = readFileSync(`${__dirname}/${f}`, 'utf8');
      const m = [...src.matchAll(/buildProvisioningTestApp\(\{([^)]*)/g)];
      for (const x of m) for (const k of ['includeSiteApi', 'includeDirectoryApi', 'includeAiApi', 'b3', 'billing', 'siteProvisioner', 'pinLegacySiteMode']) if (x[1].includes(k)) used.add(k);
    }
    const covered = new Set<string>(['siteProvisioner']);   // siteProvisioner is applied after compile
    for (const [, o] of OPTION_SETS) for (const k of Object.keys(o)) covered.add(k);
    covered.add('pinLegacySiteMode');                        // applied after compile
    expect([...used].filter((k) => !covered.has(k))).toEqual([]);
  });
});
