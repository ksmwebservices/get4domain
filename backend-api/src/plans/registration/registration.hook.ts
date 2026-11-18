import { HttpException, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_SITE_BASE } from '../../site-publish/publish/site-config';
import { SubscriptionsService, TRACKS } from '../subscriptions/subscriptions.service';
import { TrialSitePort } from './trial-site.port';

/** What the signup form knew about the business, for the trial site (Wave 3 Part G). */
export interface RegistrationInfo { industry: string; businessName: string; phone?: string | null }

/**
 * What the registration answer says about the vendor's site, so the public page can tell the truth (B2.1):
 * LIVE (made, `published` says whether it is served), FAILED (recorded on the vendor; "Create my site" retries), NOT_SWITCHED_ON (the staff switch is off: no plan, no site).
 */
export interface SiteAnswer { status: 'LIVE' | 'FAILED' | 'NOT_SWITCHED_ON'; published: boolean; subdomain: string | null; url: string | null }

const TRACK_DEFAULT = 'handyman';   // the lowest tier, used only when a category has no stored minimum tier
const CODE = /^[A-Z][A-Z0-9_]{2,40}$/;

/**
 * Called from the existing registration path (AuthService.register) after the vendor exists. It does something only when the plan setting
 * `registrationProvisioning` is true (default false); then the vendor gets the FREE plan of a track and the live trial site.
 * The track is the one the signup sent, or else the minimum tier of the chosen category (B2.1: a Free signup sends none).
 * It can never block or fail a registration. A failure is logged WITHOUT the error text (which can carry connection details) and recorded on the vendor as a short code,
 * so the vendor app can offer "Create my site" (`createMySite`) instead of showing an empty account.
 */
@Injectable()
export class RegistrationHook {
  private readonly logger = new Logger(RegistrationHook.name);

  constructor(private readonly prisma: PrismaService, private readonly subscriptions: SubscriptionsService, @Optional() private readonly trialSite?: TrialSitePort) {}

  /** The track to use: the one sent, else the category's minimum tier, else the lowest. Never throws. */
  async resolveTrack(track: string | undefined, industry: string | undefined): Promise<string> {
    if (track && (TRACKS as readonly string[]).includes(track)) return track;
    try {
      const row = industry ? await this.prisma.v3PackCategory.findUnique({ where: { categoryKey: industry }, select: { minTier: true } }) : null;
      const t = row?.minTier?.toLowerCase();
      if (t && (TRACKS as readonly string[]).includes(t)) return t;
    } catch { /* fall through to the default */ }
    return TRACK_DEFAULT;
  }

  async afterRegister(vendorId: string, track?: string, info?: RegistrationInfo): Promise<SiteAnswer> {
    try {
      const setting = await this.prisma.v3PlanSetting.findUnique({ where: { key: 'registrationProvisioning' } });
      if (setting?.valueJson !== true) return this.answer(vendorId, 'NOT_SWITCHED_ON', false);
      return await this.provision(vendorId, await this.resolveTrack(track, info?.industry), info);
    } catch (e) {
      this.logger.warn(`Registration provisioning failed for new vendor ${vendorId} (${e instanceof Error ? e.name : 'error'}); registration continues.`);
      return this.answer(vendorId, 'FAILED', false).catch(() => ({ status: 'FAILED' as const, published: false, subdomain: null, url: null }));
    }
  }

  /** The vendor's own "Create my site" (B2.1): the same steps as signup, from the vendor's stored details, whatever the switch says. Idempotent (plan and site both return what exists). */
  async createMySite(vendorId: string, source: 'REGISTRATION' | 'STAFF' = 'REGISTRATION'): Promise<SiteAnswer> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { industry: true, businessName: true, phone: true } });
    if (!v) throw new HttpException({ code: 'UNKNOWN_VENDOR', message: 'That vendor does not exist.' }, 404);
    return this.provision(vendorId, await this.resolveTrack(undefined, v.industry ?? undefined), { industry: v.industry ?? '', businessName: v.businessName, phone: v.phone }, source);
  }

  private async provision(vendorId: string, track: string, info?: RegistrationInfo, source: 'REGISTRATION' | 'STAFF' = 'REGISTRATION'): Promise<SiteAnswer> {
    try {
      await this.subscriptions.provisionFreeSubscription(vendorId, track, source);
    } catch (e) {
      return this.fail(vendorId, 'PLAN_FAILED', e);
    }
    if (!info || !this.trialSite) return this.answer(vendorId, 'NOT_SWITCHED_ON', false);
    // Wave 3 Part G: the Free trial site, live on the chosen subdomain. Its own failure leaves the plan and the signup untouched, and is recorded.
    try {
      const made = await this.trialSite.createLiveTrialSite({ vendorId, track, category: info.industry, businessName: info.businessName, phone: info.phone ?? null });
      await this.prisma.vendor.update({ where: { id: vendorId }, data: { siteProvisionStatus: null, siteProvisionCode: null, siteProvisionFailedAt: null } });
      return this.answer(vendorId, 'LIVE', made.published);
    } catch (e) {
      return this.fail(vendorId, 'SITE_FAILED', e);
    }
  }

  /** Logs without the error text, records FAILED plus a code on the vendor, answers FAILED. The code is the error's own `code` when it is a plain upper-case code, else the fallback. */
  private async fail(vendorId: string, fallback: string, e: unknown): Promise<SiteAnswer> {
    this.logger.warn(`${fallback} for vendor ${vendorId} (${e instanceof Error ? e.name : 'error'}).`);
    const raw = e instanceof HttpException ? (e.getResponse() as { code?: unknown })?.code : undefined;
    const code = typeof raw === 'string' && CODE.test(raw) ? raw : fallback;
    try { await this.prisma.vendor.update({ where: { id: vendorId }, data: { siteProvisionStatus: 'FAILED', siteProvisionCode: code, siteProvisionFailedAt: new Date() } }); }
    catch { this.logger.warn(`Could not record the site failure on vendor ${vendorId}.`); }
    return this.answer(vendorId, 'FAILED', false);
  }

  private async answer(vendorId: string, status: SiteAnswer['status'], published: boolean): Promise<SiteAnswer> {
    let subdomain: string | null = null;
    try { subdomain = (await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { subdomain: true } }))?.subdomain ?? null; } catch { /* the answer still says the status */ }
    const base = process.env.SITE_BASE_DOMAIN || DEFAULT_SITE_BASE;
    return { status, published, subdomain, url: subdomain && status === 'LIVE' ? `https://${subdomain}.${base}` : null };
  }
}
