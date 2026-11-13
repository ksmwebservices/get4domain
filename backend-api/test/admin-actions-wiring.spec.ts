// @nestjs/schedule ships ES modules the unit project cannot load; only the decorators are needed here.
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_5_MINUTES: '*/5 * * * *', EVERY_30_SECONDS: '*/30 * * * * *' }, ScheduleModule: { forRoot: () => ({ module: class {} }) } }));
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { HostDirectory } from '../src/site-domains/host-directory';
import { PublicSiteController } from '../src/site-publish/api/public-site.controller';
import { SitePublicService } from '../src/site-publish/publish/site-public.service';
import { VisitCounterPort } from '../src/site-publish/publish/visit-counter.port';
import { ADMIN_ACTIONS_PROVIDERS } from '../src/v3-admin-actions/admin-actions.module';
import { AdminActionsService } from '../src/v3-admin-actions/admin-actions.service';
import { HostVisitService } from '../src/v3-admin-actions/host-visits.service';

/**
 * The staff actions resolve together, and the page counter really reaches the public page route (an optional port with nothing bound would silently count nothing). The database is stubbed, nothing connects.
 */
describe('dependency injection of the staff actions', () => {
  it('every provider resolves, and the counter bound for the public route is the real visit service', async () => {
    const external = [PrismaService, SubscriptionsService, HostDirectory].map((provide) => ({ provide, useValue: {} }));
    const m = await Test.createTestingModule({ providers: [...external, ...ADMIN_ACTIONS_PROVIDERS] }).compile();
    expect(m.get(AdminActionsService)).toBeInstanceOf(AdminActionsService); expect(m.get(VisitCounterPort)).toBe(m.get(HostVisitService));
  });
});

describe('the public page route counts a page served', () => {
  const page = (status: number) => ({ status, html: '<p>hi</p>', etag: '"e1"', lang: 'en', contentType: 'text/html', robots: null, canonicalHost: null, location: null });
  const run = async (looked: unknown, ifNoneMatch?: string) => {
    const recorded: string[] = []; const sites = { lookup: async () => looked } as unknown as SitePublicService;
    const m = await Test.createTestingModule({ controllers: [PublicSiteController], providers: [{ provide: SitePublicService, useValue: sites }, { provide: VisitCounterPort, useValue: { record: (h: string) => recorded.push(h) } }] }).compile();
    const res = { statusCode: 0, status(c: number) { this.statusCode = c; return this; }, set() { return this; }, send() { return this; }, end() { return this; } };
    await m.get(PublicSiteController).byHost('shop.example.com', '/', 'en', ifNoneMatch, res as never); return { recorded, status: res.statusCode };
  };
  it('a 200 counts once, a 304 counts once, a 404 and a redirect count nothing', async () => {
    expect(await run(page(200))).toEqual({ recorded: ['shop.example.com'], status: 200 });
    expect(await run(page(200), '"e1"')).toEqual({ recorded: ['shop.example.com'], status: 304 });
    expect(await run(null)).toEqual({ recorded: [], status: 404 }); expect(await run({ ...page(301), status: 301 })).toMatchObject({ recorded: [] });
  });
  it('the route still works with no counter bound', async () => {
    const m = await Test.createTestingModule({ controllers: [PublicSiteController], providers: [{ provide: SitePublicService, useValue: { lookup: async () => page(200) } }] }).compile();
    const res = { statusCode: 0, status(c: number) { this.statusCode = c; return this; }, set() { return this; }, send() { return this; }, end() { return this; } };
    await m.get(PublicSiteController).byHost('shop.example.com', '/', 'en', undefined, res as never); expect(res.statusCode).toBe(200);
  });
});
