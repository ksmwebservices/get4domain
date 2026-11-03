import { Test } from '@nestjs/testing';
import { PlansModule } from '../src/plans/plans.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ContentSource, CmsContentSource } from '../src/site-publish/content/content-source';
import { PrismaSiteAudit, SiteAudit } from '../src/site-publish/publish/site-audit';
import { PrismaSiteRepository, SubdomainHostResolver } from '../src/site-publish/publish/prisma-site.repository';
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
    expect(mod.get(HostResolver)).toBeInstanceOf(SubdomainHostResolver);
    expect(mod.get(ContentSource)).toBeInstanceOf(CmsContentSource);
    expect(mod.get(SiteAudit)).toBeInstanceOf(PrismaSiteAudit);
    for (const c of [ThemeRenderService, SiteBuildService, PublishService, SiteSettingsService, SitePublicService]) expect(mod.get(c)).toBeDefined();
    await mod.close();
  });

  it('the host resolver only knows <subdomain>.<site base>, and answers null for anything else without touching the database', async () => {
    const r = new SubdomainHostResolver({ vendor: { findUnique: jest.fn() } } as never);
    for (const h of ['get4domain.com', 'www.example.com', 'a.b.c.get4domain.com', '-bad.get4domain.com', 'x_y.get4domain.com', 'evil.get4domain.com.attacker.test']) expect(await r.resolve(h)).toBeNull();
  });

  it('a suspended vendor and an unknown subdomain resolve to the same null; an active or pending vendor resolves', async () => {
    const find = jest.fn(async ({ where }: { where: { subdomain: string } }) => ({ acme: { id: 'v1', status: 'PENDING' }, gone: { id: 'v2', status: 'SUSPENDED' } } as Record<string, { id: string; status: string }>)[where.subdomain] ?? null);
    const r = new SubdomainHostResolver({ vendor: { findUnique: find } } as never);
    expect(await r.resolve('acme.get4domain.com')).toEqual({ vendorId: 'v1' });
    expect(await r.resolve('gone.get4domain.com')).toBeNull(); expect(await r.resolve('nobody.get4domain.com')).toBeNull();
  });
});
