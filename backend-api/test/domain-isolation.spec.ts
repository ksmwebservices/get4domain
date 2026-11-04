import * as fs from 'fs';
import * as path from 'path';
import { Test } from '@nestjs/testing';
import { VENDOR_SCOPED_MODELS } from '../src/common/tenant/for-tenant';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HostResolver } from '../src/site-publish/publish/site-public.service';
import { VendorHosts } from '../src/site-publish/publish/vendor-hosts';
import { DomainRepository } from '../src/site-domains/domain.repository';
import { HostDirectory } from '../src/site-domains/host-directory';
import { PrismaDomainRepository } from '../src/site-domains/prisma-domain.repository';
import { DnsGate, NodeDnsResolver } from '../src/site-domains/dns-gate';
import { DomainHostResolver, DomainVendorHosts } from '../src/site-domains/site-publish-adapters';
import { SiteDomainsModule } from '../src/site-domains/site-domains.module';
import { SitePublishModule } from '../src/site-publish/site-publish.module';
import { findLegacyUse } from './support/legacy-scan';

/** Slice 5.6 static checks: decision D1 (no legacy tables), pure core, no registrar or DNS write, tenant scope, wiring. */
const src = path.resolve(__dirname, '../src');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const files = tsFiles(path.join(src, 'site-domains'));
const rel = (f: string): string => path.relative(src, f).replace(/\\/g, '/');
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('site-domains and the legacy world (decision D1)', () => {
  it('there is code to scan', () => { expect(files.length).toBeGreaterThan(12); });
  it('no file imports or queries a legacy billing, BOS, commercial, domain-campaign, vendor-payments, add-on or module table or constant', () => {
    expect(files.flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((h) => `${rel(f)}: ${h}`))).toEqual([]);
  });
  it('never touches the legacy domain module (ResellerClub, DomainRegistration, domain campaigns) or the legacy domains controllers', () => {
    const bad = files.filter((f) => /resellerclub|domainRegistration|domainCampaign|from '\.\.\/domains\/|from '\.\.\/\.\.\/domains\//i.test(code(f))).map(rel);
    expect(bad).toEqual([]);
  });
  it('the only legacy-adjacent table it writes is Vendor.subdomain (the column the legacy site renderer reads), and only in one place', () => {
    const writers = files.filter((f) => /\.vendor\.(update|create|delete|upsert)/.test(code(f))).map(rel);
    expect(writers).toEqual(['site-domains/prisma-domain.repository.ts']);
  });
});

describe('purity and safety of the core', () => {
  it.each(['hostname.ts', 'canonical.ts', 'verification.ts'])('core/%s has no clock, randomness, network, file system or database', (f) => {
    const c = code(path.join(src, 'site-domains/core', f));
    expect(c).not.toMatch(/Date\.now|new Date\(|Math\.random|randomBytes|randomUUID|fetch\(|https?\.request|from 'fs'|from 'dns'|require\(|prisma|PrismaService/);
  });
  it('nothing here calls a registrar, issues a certificate or writes DNS; the real resolver is only created lazily behind the setting', () => {
    for (const f of files) expect(code(f)).not.toMatch(/acme|certbot|letsencrypt|cloudflare|resellerclub|registrar|nginx|createRecord|changeResourceRecordSets/i);
    const gate = code(path.join(src, 'site-domains/dns-gate.ts'));
    expect(gate).toContain('domainDnsLiveChecks');
    expect(gate).toMatch(/\?\?=\s*new NodeDnsResolver/);
    const others = files.filter((f) => rel(f) !== 'site-domains/dns-gate.ts');
    for (const f of others) expect(code(f)).not.toMatch(/NodeDnsResolver|require\('dns'\)|from 'dns/);
  });
  it('the real resolver is not constructed by merely wiring the module', () => {
    expect(new DnsGate({ get: async () => ({ domainDnsLiveChecks: false }) } as never)).toBeInstanceOf(DnsGate);
    expect(NodeDnsResolver.length).toBeLessThanOrEqual(1);
  });
  it('a gate with live checks off returns null and one with them on returns the real resolver (never a fake in production code)', async () => {
    expect(await new DnsGate({ get: async () => ({ domainDnsLiveChecks: false }) } as never).resolver()).toBeNull();
    expect(await new DnsGate({ get: async () => ({ domainDnsLiveChecks: true }) } as never).resolver()).toBeInstanceOf(NodeDnsResolver);
  });
});

describe('tenant scope and wiring', () => {
  it('the three tables carry a vendorId and are tenant-scoped', () => { for (const m of ['V3Domain', 'V3DomainVerification', 'V3Redirect']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true); });
  it('the real modules compile and bind the ports to their real implementations (Prisma replaced by an empty stub; nothing connects)', async () => {
    const mod = await Test.createTestingModule({ imports: [PlansModule, SitePublishModule, SiteDomainsModule] }).overrideProvider(PrismaService).useValue({}).compile();
    expect(mod.get(DomainRepository)).toBeInstanceOf(PrismaDomainRepository);
    expect(mod.get(HostResolver)).toBeInstanceOf(DomainHostResolver);
    expect(mod.get(VendorHosts)).toBeInstanceOf(DomainVendorHosts);
    expect(mod.get(HostDirectory)).toBeDefined();
    await mod.close();
  });
  it('the staging cleanup needs no change: the three tables cascade from Vendor', () => {
    const migration = fs.readdirSync(path.resolve(__dirname, '../prisma/migrations')).find((d) => /_v3_domains$/.test(d))!;
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
    for (const t of ['g4d_domains', 'g4d_domain_verifications', 'g4d_redirects']) expect(sql).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_vendorId_fkey"[^;]*ON DELETE CASCADE`));
  });
});
