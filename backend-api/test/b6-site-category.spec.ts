import { ConflictException, HttpException } from '@nestjs/common';
import { RegistrationHook } from '../src/plans/registration/registration.hook';
import { categoryFor, categoryForTrack, TRACK_FALLBACK_CATEGORY } from '../src/site-publish/content/content-adapter';
import { siteError } from '../src/site-publish/site.errors';
import { ModuleTrialSite } from '../src/v3-trial/module-trial-site';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { PublishService } from '../src/site-publish/publish/publish.service';
import { SiteBuildService } from '../src/site-publish/publish/site-build.service';
import { doc as makeDoc, entitlements } from './support/site-fixtures';
import { OWNER, siteWorld, themeService } from './support/site-world';

/**
 * B6.1: a Free vendor whose category is a free-text industry (the registration form sends the track name, "services", "hr" ...) failed the trial site on EVERY attempt with
 * ConflictException PUBLISH_BLOCKED, rule CATEGORY (SiteBuildService: "This business has no category yet"). Retry could never help: nothing about the vendor's own draft, address or listing was involved.
 * These tests fail on the old behaviour (the build threw) and pass now (the neutral design of the vendor's track is used).
 */
jest.setTimeout(120_000);
const code = (e: unknown): string => String(((e as HttpException).getResponse?.() as { code?: string } | undefined)?.code);
const freeTextDoc = (industry: string) => makeDoc('plumber', { vendor: { industry }, cms: { packKey: industry } });

describe('B6.1 the build rule that threw', () => {
  it.each(['handyman', 'services', 'general', 'hr', 'Handyman'])('a Free handyman vendor with the free-text category "%s" builds and publishes, and a retry changes nothing', async (industry) => {
    const w = siteWorld({ doc: freeTextDoc(industry), level: 'FREE' });
    const kit = themeService().kitApi;
    expect(categoryFor(w.state.doc!, kit, kit.categoryMap())).toBeNull();   // the kit really cannot place it: this is what threw before
    const a = await w.build.build('v-plumber', { actor: OWNER });
    expect(a.reused).toBe(false);
    const b = await w.build.build('v-plumber', { actor: OWNER });   // the vendor's own retry
    expect(b.reused).toBe(true); expect(b.publication.id).toBe(a.publication.id); expect(w.repo.pubs.size).toBe(1);
    const p = await w.publish.publish('v-plumber', a.publication.id, OWNER);
    expect(p.status).toBe('PUBLISHED');
    const again = await w.build.build('v-plumber', { actor: OWNER });
    expect(again.publication.id).toBe(a.publication.id);   // a published site is not rebuilt into a second version
  });

  it('a vendor whose track is unknown and whose category cannot be placed still gets the honest refusal (PUBLISH_BLOCKED, CATEGORY)', async () => {
    const w = siteWorld({ doc: freeTextDoc('handyman'), level: 'FREE' });
    w.state.ent = { ...w.state.ent, track: null };
    const err = await w.build.build('v-plumber', { actor: OWNER }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException); expect(code(err)).toBe('PUBLISH_BLOCKED');
    expect(JSON.stringify((err as HttpException).getResponse())).toContain('CATEGORY');
  });

  it('a category the kit does know is never replaced by the track default', () => {
    const kit = themeService().kitApi; const d = makeDoc('dentist');
    expect(categoryForTrack(d, kit, kit.categoryMap(), 'handyman')).toBe(categoryFor(d, kit, kit.categoryMap()));
  });

  it('every track default is a real kit category of that same track', () => {
    const kit = themeService().kitApi;
    for (const [track, id] of Object.entries(TRACK_FALLBACK_CATEGORY)) { expect(kit.hasCategory(id)).toBe(true); expect(kit.categoryById(id).track).toBe(track); }
    expect(entitlements('FREE', 'handyman').track).toBe('handyman');
  });
});

describe('B6.1 the failure is logged and recorded with its code, stage and rule, and no personal data', () => {
  it('describe() reads the registered code, the missing-field rule and the stage', () => {
    const e = new ConflictException(siteError('PUBLISH_BLOCKED', 'This business has no category yet, so its site cannot be built.', { missing: [{ code: 'CATEGORY', label: 'The business needs a category' }] }));
    (e as { siteStage?: string }).siteStage = 'build';
    expect(RegistrationHook.describe('SITE_FAILED', e)).toEqual({ code: 'PUBLISH_BLOCKED', stage: 'build', rule: 'CATEGORY' });
  });
  it('an error with no registered code falls back, and a stage or rule that is not a plain word is dropped', () => {
    const e = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432 user=secret'), { siteStage: 'Bad Stage; DROP' });
    expect(RegistrationHook.describe('SITE_FAILED', e)).toEqual({ code: 'SITE_FAILED', stage: null, rule: null });
    const odd = new ConflictException({ code: 'PUBLISH_BLOCKED', missing: [{ code: 'phone 98400' }, { code: 'ADDRESS' }] });
    expect(RegistrationHook.describe('SITE_FAILED', odd).rule).toBe('ADDRESS');
  });
  it('the hook warns with code, stage and rule, records the code, and the log line holds no e-mail, phone or error text', async () => {
    const lines: string[] = [];
    const { Logger } = await import('@nestjs/common');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m: unknown) => { lines.push(String(m)); });
    const row: Record<string, unknown> = {};
    const prisma = { v3PlanSetting: { findUnique: async () => ({ valueJson: true }) }, v3PackCategory: { findUnique: async () => null }, vendor: { findUnique: async () => ({ subdomain: 's' }), update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(row, data) } };
    const err = Object.assign(new ConflictException(siteError('PUBLISH_BLOCKED', 'secret text owner@example.test 9840012345', { missing: [{ code: 'CATEGORY', label: 'x' }] })), { siteStage: 'build' });
    const hook = new RegistrationHook(prisma as never, { provisionFreeSubscription: async () => ({}) } as never, { createLiveTrialSite: async () => { throw err; } });
    const a = await hook.afterRegister('v1', 'handyman', { industry: 'handyman', businessName: 'X', phone: '9840012345' });
    jest.restoreAllMocks();
    expect(a.status).toBe('FAILED'); expect(row).toMatchObject({ siteProvisionStatus: 'FAILED', siteProvisionCode: 'PUBLISH_BLOCKED' });
    const line = lines.find((l) => l.includes('SITE_FAILED'))!;
    expect(line).toContain('siteProvisionCode=PUBLISH_BLOCKED'); expect(line).toContain('stage=build'); expect(line).toContain('rule=CATEGORY'); expect(line).toContain('ConflictException');
    expect(line).not.toMatch(/owner@example|9840012345|secret text/);
  });
  it('the trial site marks the stage that raised: draft, build or publish', async () => {
    const mk = (over: { draft?: boolean; build?: boolean; publish?: boolean }) => {
      const parts = new Map<unknown, unknown>([
        [SiteProvisioner, { createDraftSite: async () => { if (over.draft) throw new Error('d'); return { siteId: 's1' }; } }],
        [SiteBuildService, { build: async () => { if (over.build) throw new Error('b'); return { publication: { id: 'p', status: 'DRAFT_PREVIEW' } }; } }],
        [PublishService, { publish: async () => { if (over.publish) throw new Error('p'); return {}; } }],
      ]);
      return new ModuleTrialSite({ get: (t: unknown) => parts.get(t) ?? { vendorCMS: { findUnique: async () => null } } } as never);
    };
    const input = { vendorId: 'v1', track: 'handyman', category: 'handyman', businessName: 'X', phone: null };
    for (const stage of ['draft', 'build', 'publish'] as const) {
      const e = await mk({ [stage]: true }).createLiveTrialSite(input).catch((x) => x);
      expect((e as { siteStage?: string }).siteStage).toBe(stage);
    }
    await expect(mk({}).createLiveTrialSite(input)).resolves.toEqual({ siteId: 's1', published: true });
  });
});
