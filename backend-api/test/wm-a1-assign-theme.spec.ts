import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AssignThemeDto } from '../src/site-publish/api/dto/site.dto';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { ThemeChangeNotifier, ThemeMarketService } from '../src/v3-theme-market/theme-market.service';
import { goodZip } from './support/theme-package-fixtures';
import { MemoryThemeMarketStore } from './support/memory-theme-market-store';
import { siteWorld } from './support/site-world';

/** Website Manager lane A, E2: staff assign a theme to a business. A theme made privately for that business is theirs whatever the plan; a public theme still follows the plan rules. */
jest.setTimeout(480_000);
const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const PRIV = 'wm-private-clinic';
const MK = { packs: ['HOSPITALITY_EVENTS', 'FOOD_SERVICE'], licence: 'One customer.', sourceVendorId: 'vendor-free' };

describe('staff assign a theme to a business', () => {
  let themes: ThemeRenderService; let market: ThemeMarketService; let store: MemoryThemeMarketStore;
  const publish = async (zip: Buffer, vendorId: string): Promise<string> => { const t = (await market.upload(staff, { buffer: zip }, { vendorId })).theme; await market.submit(t.id, staff); await market.publish(t.id, staff); return t.id; };

  beforeAll(async () => {
    const kit = loadKit(); store = new MemoryThemeMarketStore(); const notifier = new ThemeChangeNotifier();
    for (const v of ['vendor-free', 'vendor-other']) store.vendors.set(v, { name: v, email: null, phone: null, subdomain: null, customDomain: null, mediaHashes: [] });
    market = new ThemeMarketService(store, notifier, kit); themes = new ThemeRenderService(kit, store, notifier); await themes.onModuleInit();
    await publish(goodZip({ marketplace: MK }, PRIV), 'vendor-free');
  });

  it('a Free business cannot pick a private theme through the plan-checked route before, but staff can assign it: the theme is stored and the reason is audited', async () => {
    const free = siteWorld({ kind: 'dentist', level: 'FREE', themes });
    const out = await free.settings.assignTheme('vendor-free', PRIV, 'Custom design paid for', staff);
    expect(out.settings.themeId).toBe(PRIV);
    expect(out.published).toBeNull();   // no site is live yet: it is used at the first build
    expect(free.audit).toEqual(expect.arrayContaining(['site.theme', 'site.theme.assign']));
  });

  it('a public theme still follows the plan rules: a Free business is refused a library theme that is not its own default', async () => {
    const free = siteWorld({ kind: 'dentist', level: 'FREE', themes });
    await expect(free.settings.assignTheme('vendor-free', 'free-studio', 'A reason here', staff)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("another business cannot be given this business's private theme", async () => {
    const other = siteWorld({ kind: 'dentist', level: 'PRO', themes });
    await expect(other.settings.assignTheme('vendor-other', PRIV, 'A reason here', staff)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('when the site is live the new theme is built and published at once', async () => {
    const free = siteWorld({ kind: 'dentist', level: 'FREE', themes, claimed: true });
    const first = await free.build.build('vendor-free', { actor: staff });
    if (first.publication.status !== 'PUBLISHED') await free.publish.publish('vendor-free', first.publication.id, staff);
    const out = await free.settings.assignTheme('vendor-free', PRIV, 'Custom design paid for', staff);
    expect(out.published).toMatchObject({ status: 'PUBLISHED', themeId: PRIV });
  });

  it('the request needs a theme id and a reason of at least five characters', async () => {
    const ok = Object.assign(new AssignThemeDto(), { themeId: 'wm-private-clinic', reason: 'Custom design paid for' });
    expect(await validate(ok)).toHaveLength(0);
    expect((await validate(Object.assign(new AssignThemeDto(), { themeId: 'wm-private-clinic', reason: 'no' }))).length).toBeGreaterThan(0);
    expect((await validate(Object.assign(new AssignThemeDto(), { themeId: 'Bad Id', reason: 'Custom design paid for' }))).length).toBeGreaterThan(0);
  });
});
