import { Test } from '@nestjs/testing';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ContentSource } from '../src/site-publish/content/content-source';
import { ManagedContentSource } from '../src/site-publish/content/managed-content-source';
import { PrismaSiteAudit, SiteAudit } from '../src/site-publish/publish/site-audit';
import { PrismaSiteRepository, SubdomainHostResolver } from '../src/site-publish/publish/prisma-site.repository';
import { DomainHostResolver } from '../src/site-domains/site-publish-adapters';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { HostResolver, SitePublicService } from '../src/site-publish/publish/site-public.service';
import { SiteSettingsService } from '../src/site-publish/publish/site-settings.service';
import { SiteRepository } from '../src/site-publish/publish/site.repository';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { SitePublishModule } from '../src/site-publish/site-publish.module';

/** S54.7: the real SitePublishModule resolves every provider with Prisma replaced by an empty stub (nothing connects to any database). */
describe('SitePublishModule wiring', () => {
  it('compiles and binds every port to its real implementation', async () => {
    const mod = await Test.createTestingModule({ imports: [PlansModule, SitePublishModule] }).overrideProvider(PrismaService).useValue({}).compile();
    expect(mod.get(SiteRepository)).toBeInstanceOf(PrismaSiteRepository);
    expect(mod.get(HostResolver)).toBeInstanceOf(DomainHostResolver);   // slice 5.6
    expect(mod.get(ContentSource)).toBeInstanceOf(ManagedContentSource);   // slice 5.5a: the legacy source with the managed document laid over it
    expect(mod.get(SiteAudit)).toBeInstanceOf(PrismaSiteAudit);
    for (const c of [ThemeRenderService, SiteBuildService, PublishService, SiteSettingsService, SitePublicService]) expect(mod.get(c)).toBeDefined();
    await mod.close();
  });

  it('the host resolver only knows <subdomain>.<site base>, and answers null for anything else without touching the database', async () => {
    const r = new SubdomainHostResolver({ vendor: { findUnique: jest.fn() } } as never);
    for (const h of ['get4domain.com', 'www.example.com', 'a.b.c.get4domain.com', '-bad.get4domain.com', 'x_y.get4domain.com', 'evil.get4domain.com.attacker.test']) expect(await r.resolve(h)).toBeNull();
  });

  it('a removed business and an unknown subdomain resolve to the same null; an active, pending or suspended vendor resolves (B3.0b)', async () => {
    const rows: Record<string, { id: string; v3SiteRemoval: { vendorId: string } | null }> = {
      acme: { id: 'v1', v3SiteRemoval: null }, held: { id: 'v3', v3SiteRemoval: null }, gone: { id: 'v2', v3SiteRemoval: { vendorId: 'v2' } },
    };
    const find = jest.fn(async ({ where }: { where: { subdomain: string } }) => rows[where.subdomain] ?? null);
    const r = new SubdomainHostResolver({ vendor: { findUnique: find } } as never);
    expect(await r.resolve('acme.get4domain.com')).toEqual({ vendorId: 'v1' }); expect(await r.resolve('held.get4domain.com')).toEqual({ vendorId: 'v3' });
    expect(await r.resolve('gone.get4domain.com')).toBeNull(); expect(await r.resolve('nobody.get4domain.com')).toBeNull();
  });
});
