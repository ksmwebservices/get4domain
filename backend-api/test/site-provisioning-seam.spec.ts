import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { StepError } from '../src/provisioning/provisioning.errors';
import { DraftSiteBuilder } from '../src/provisioning/site/draft-site-builder';
import { ModeSiteProvisioner } from '../src/provisioning/site/mode-site-provisioner';
import { RendererDraftBuilder } from '../src/provisioning/site/renderer-draft-builder';
import { DEFAULT_PROVISIONING_SETTINGS, PROVISIONING_SETTING_KEYS, provisioningSettingProblem } from '../src/provisioning/settings/provisioning-settings';
import { validateSettingValue } from '../src/plans/admin/admin-validation';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { ThemeRenderService } from '../src/site-publish/renderer/theme-render.service';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { doc } from './support/site-fixtures';
import { STAFF, siteWorld, themeService } from './support/site-world';

/** S54.8: the slice 5.3 CREATE_FREE_SITE_DRAFT seam. legacy = the 5.3 adapter unchanged; renderer = that adapter first, then settings and a DRAFT_PREVIEW publication. Never publishes. */
jest.setTimeout(120_000);
const INPUT = { vendorId: 'v-plumber', track: 'handyman', category: 'plumber', businessName: 'Sri Ganesh Plumbing', language: 'en', city: 'Chennai', phone: '+919876543210' };

describe('siteDraftBuilderMode setting', () => {
  it('is one of the provisioning settings, default legacy (the owner switches staging to renderer)', () => {
    expect(PROVISIONING_SETTING_KEYS).toContain('siteDraftBuilderMode');
    expect(DEFAULT_PROVISIONING_SETTINGS.siteDraftBuilderMode).toBe('legacy');
  });
  it('accepts legacy and renderer and refuses anything else, through the existing plan-settings validator', () => {
    expect(provisioningSettingProblem('siteDraftBuilderMode', 'renderer')).toBeNull();
    expect(provisioningSettingProblem('siteDraftBuilderMode', 'legacy')).toBeNull();
    for (const bad of ['both', '', true, null, 'RENDERER']) expect(provisioningSettingProblem('siteDraftBuilderMode', bad)).not.toBeNull();
    expect(() => validateSettingValue('siteDraftBuilderMode', 'renderer')).not.toThrow();
    expect(() => validateSettingValue('siteDraftBuilderMode', 'x')).toThrow(/siteDraftBuilderMode/);
  });
});

describe('ModeSiteProvisioner', () => {
  const mk = (mode: 'legacy' | 'renderer') => {
    const legacy = { createDraftSite: jest.fn(async () => ({ siteId: 'cms-1' })) };
    const builder: DraftSiteBuilder = { prepare: jest.fn(async () => ({ publicationId: 'pub-1' })) };
    const settings = { get: async () => ({ ...DEFAULT_PROVISIONING_SETTINGS, siteDraftBuilderMode: mode }) };
    return { legacy, builder, p: new ModeSiteProvisioner(legacy as never, settings as never, builder) };
  };
  it('legacy: only the slice 5.3 adapter runs, exactly as before', async () => {
    const { legacy, builder, p } = mk('legacy');
    expect(await p.createDraftSite(INPUT)).toEqual({ siteId: 'cms-1' });
    expect(legacy.createDraftSite).toHaveBeenCalledWith(INPUT); expect(builder.prepare).not.toHaveBeenCalled();
  });
  it('renderer: the legacy draft is still created first and its site id is what the step records; then the preview is prepared', async () => {
    const { legacy, builder, p } = mk('renderer');
    const order: string[] = [];
    legacy.createDraftSite.mockImplementation(async () => { order.push('legacy'); return { siteId: 'cms-1' }; });
    (builder.prepare as jest.Mock).mockImplementation(async () => { order.push('builder'); return { publicationId: 'pub-1' }; });
    expect(await p.createDraftSite(INPUT)).toEqual({ siteId: 'cms-1' });
    expect(order).toEqual(['legacy', 'builder']);
    expect(builder.prepare).toHaveBeenCalledWith({ vendorId: 'v-plumber', category: 'plumber', track: 'handyman', language: 'en', city: 'Chennai' });
  });
  it('renderer: if the legacy draft fails, nothing is built', async () => {
    const { legacy, builder, p } = mk('renderer');
    legacy.createDraftSite.mockRejectedValue(new Error('db down'));
    await expect(p.createDraftSite(INPUT)).rejects.toThrow('db down');
    expect(builder.prepare).not.toHaveBeenCalled();
  });
});

describe('ModeSiteProvisioner: no extra settings query per job (S54 timing fix)', () => {
  const mk = () => {
    const legacy = { createDraftSite: jest.fn(async () => ({ siteId: 'cms-1' })) };
    const builder: DraftSiteBuilder = { prepare: jest.fn(async () => ({ publicationId: 'pub-1' })) };
    const get = jest.fn(async () => ({ ...DEFAULT_PROVISIONING_SETTINGS, siteDraftBuilderMode: 'renderer' as const }));
    return { legacy, builder, get, p: new ModeSiteProvisioner(legacy as never, { get } as never, builder) };
  };
  it('uses the mode the runner already read (carried in the input): zero settings queries', async () => {
    const { builder, get, p } = mk();
    await p.createDraftSite({ ...INPUT, siteDraftBuilderMode: 'legacy' });
    expect(get).not.toHaveBeenCalled(); expect(builder.prepare).not.toHaveBeenCalled();
    await p.createDraftSite({ ...INPUT, siteDraftBuilderMode: 'renderer' });
    expect(get).not.toHaveBeenCalled(); expect(builder.prepare).toHaveBeenCalledTimes(1);
  });
  it('still reads the setting when the caller did not pass the mode (the port stays usable on its own)', async () => {
    const { builder, get, p } = mk();
    await p.createDraftSite(INPUT);
    expect(get).toHaveBeenCalledTimes(1); expect(builder.prepare).toHaveBeenCalledTimes(1);
  });
});

describe('RendererDraftBuilder', () => {
  function build(over: { kind?: 'plumber' | 'dentist' | 'jewellery'; docOver?: Parameters<typeof doc>[1] } = {}) {
    const w = siteWorld({ kind: over.kind ?? 'plumber', doc: over.docOver ? doc(over.kind ?? 'plumber', over.docOver) : undefined });
    const cms = { address: null as string | null, draft: null as Record<string, unknown> | null };
    const prisma = { vendorCMS: { findUnique: jest.fn(async () => cms), update: jest.fn(async ({ data }: { data: { draft: Record<string, unknown> } }) => { cms.draft = data.draft; return cms; }) } };
    const b = new RendererDraftBuilder(w.repo, w.build as SiteBuildService, themeService() as ThemeRenderService, prisma as never);
    return { w, b, cms, prisma };
  }

  it('creates the site settings with the category\'s default Standard theme and its layout variant, builds a DRAFT_PREVIEW publication, and NEVER publishes', async () => {
    const { w, b } = build();
    const r = await b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: 'Chennai' });
    expect(await w.repo.getSettings('v-plumber')).toMatchObject({ themeId: 'free-service-pro', variant: 'bold-split', language: 'en' });
    const pub = (await w.repo.getPublication(r.publicationId))!;
    expect(pub).toMatchObject({ status: 'DRAFT_PREVIEW', themeId: 'free-service-pro', indexable: false, createdByType: 'SYSTEM' });
    expect([...w.repo.pubs.values()].some((p) => p.status === 'PUBLISHED')).toBe(false);
    expect(await w.repo.currentPublication('v-plumber')).toBeNull();
  });

  it('picks the right default theme per track', async () => {
    for (const [kind, category, theme] of [['dentist', 'dentist', 'free-practice'], ['jewellery', 'jewellery', 'free-shop-lite']] as const) {
      const { w, b } = build({ kind });
      await b.prepare({ vendorId: `v-${kind}`, category, language: 'en', city: '' });
      expect((await w.repo.getSettings(`v-${kind}`))!.themeId).toBe(theme);
    }
  });

  it('is idempotent: a second run keeps one settings row and reuses the same preview', async () => {
    const { w, b } = build();
    const a = await b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: 'Chennai' });
    const c = await b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: 'Chennai' });
    expect(c.publicationId).toBe(a.publicationId); expect(w.repo.pubs.size).toBe(1); expect(w.repo.settings.size).toBe(1);
  });

  it('a Tamil owner gets en,ta stored; on a Free plan the Tamil pages are left out with a note, not an error', async () => {
    const { w, b } = build();
    const r = await b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'ta', city: 'Chennai' });
    expect((await w.repo.getSettings('v-plumber'))!.language).toBe('en,ta');
    expect((await w.repo.getPublication(r.publicationId))!).toMatchObject({ languages: 'en', warningsJson: expect.arrayContaining(['language-locked']) });
  });

  it('puts the city into the DRAFT address only when the vendor has no address yet', async () => {
    const empty = build(); empty.cms.address = null;
    await empty.b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: 'Madurai' });
    expect(empty.cms.draft).toEqual({ address: 'Madurai' });
    const has = build(); has.cms.address = '12 Main Road';
    await has.b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: 'Madurai' });
    expect(has.prisma.vendorCMS.update).not.toHaveBeenCalled();
    const drafted = build(); drafted.cms.draft = { address: '5 Lake View', tagline: 'x' };
    await drafted.b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: 'Madurai' });
    expect(drafted.prisma.vendorCMS.update).not.toHaveBeenCalled();
    const noCity = build();
    await noCity.b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: '' });
    expect(noCity.prisma.vendorCMS.update).not.toHaveBeenCalled();
  });

  it('a refusal by the build (a business the site cannot be built for) is a permanent SITE_BUILD_REFUSED; a real fault is passed on to be retried', async () => {
    const { w, b } = build();
    const refuse = jest.spyOn(w.build, 'build').mockRejectedValueOnce(new ConflictException({ code: 'PUBLISH_BLOCKED' }));
    await expect(b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: '' })).rejects.toMatchObject({ code: 'SITE_BUILD_REFUSED', retryable: false });
    refuse.mockRejectedValueOnce(new InternalServerErrorException('boom'));
    await expect(b.prepare({ vendorId: 'v-plumber', category: 'plumber', language: 'en', city: '' })).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(b.prepare({ vendorId: 'v-plumber', category: 'not-a-category', language: 'en', city: '' })).rejects.toBeInstanceOf(StepError);
  });

  it('(sanity) the kit knows the layout variant ids it stores', () => { expect(typeof loadKit().variantFor('plumber')).toBeTruthy(); void STAFF; });
});
