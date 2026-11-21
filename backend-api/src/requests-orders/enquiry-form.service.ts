import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { ActivityBus } from '../common/activity-bus';
import { b3Error } from '../b3-settings/b3-errors';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { normalisePhoneE164 } from '../directory/core/otp';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { normaliseEmail } from '../provisioning/steps/business-input';
import { ConsentGate } from '../v3-mail/consent.port';
import { planActive } from '../v3-mail/core/mail-core';
import { InboxService } from '../v3-mail/inbox.service';
import { MailSettingsService } from '../v3-mail/settings/mail-settings';
import { PublicRequestsService } from './public-requests.service';

/** What the theme's enquiry form posts (`name`, `phone`, `message`, `consent`, `source`), plus the optional extras a themed page may add. Any other field is ignored, never stored. */
export interface EnquiryForm { name?: unknown; phone?: unknown; email?: unknown; message?: unknown; consent?: unknown; source?: unknown; item?: unknown; website?: unknown; otp?: unknown }
export type EnquiryResult = { received: true; reference: string | null } | { otpRequired: true; message: string };

const invalid = (errors: string[]): BadRequestException => new BadRequestException(b3Error('REQUEST_INVALID', 'Some details are missing or not valid.', { errors }));
const text = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '').trim();
/** An HTML checkbox posts "on"; a script may post true, "true", "yes" or "1". Anything else (including no field at all) is no consent. */
export const consentGiven = (v: unknown): boolean => v === true || ['on', 'true', 'yes', '1'].includes(text(v).toLowerCase());
const NO_MESSAGE = '(no message written)';

/**
 * The one public route a vendor site's enquiry form posts to (`POST /v3/public/sites/:host/enquire`). It turns what the form sends into the request the bridge already validates, throttles, scores for spam
 * and stores (PublicRequestsService.submit), so every rule of the bridge applies unchanged: one plain 404 for a host that must reveal nothing, the idempotency, the block list, the phone code on a high score.
 * What it adds: (1) a server-made idempotency key, so a double click or a retried post inside the duplicate window is ONE enquiry; (2) the consent object for the current text version, built from the
 * checkbox the visitor ticked; (3) the written copy in the vendor's inbox (the one the Enquiries screen and the tab badge read) with the e-mail alert behind the owner's flag; (4) the held rule: for a
 * business whose plan is not active the enquiry is kept (HELD, never forwarded) only while the owner's `heldEnquiriesEnabled` is on AND counsel's consent text is published, otherwise one plain 404.
 */
@Injectable()
export class EnquiryFormService {
  private readonly log = new Logger(EnquiryFormService.name);
  clock: () => Date = () => new Date();

  constructor(
    private readonly requests: PublicRequestsService, private readonly inbox: InboxService, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>,
    @Inject(EntitlementsService) private readonly ents: Pick<EntitlementsService, 'resolve'>, private readonly mailSettings: MailSettingsService, private readonly consent: ConsentGate,
    @Optional() private readonly bus?: ActivityBus,
  ) {}

  /** The key is the same for the same visitor sending the same words to the same site inside one duplicate window, so the second post is a replay, not a second enquiry. */
  async keyFor(host: string, phoneE164: string, message: string): Promise<string> {
    const s = await this.b3.get(); const windowMs = Math.max(1, s.requestDuplicateWindowMinutes) * 60_000;
    const bucket = Math.floor(this.clock().getTime() / windowMs);
    return `form-${createHash('sha256').update(`${host}|${phoneE164}|${message.toLowerCase()}|${bucket}`).digest('hex').slice(0, 40)}`;
  }

  async enquire(hostIn: string, form: EnquiryForm, ip: string | null): Promise<EnquiryResult> {
    const s = await this.b3.get();
    const name = text(form?.name).replace(/\s+/g, ' ');
    const phoneRaw = text(form?.phone); const phone = normalisePhoneE164(phoneRaw);
    const emailRaw = text(form?.email); const email = emailRaw ? normaliseEmail(emailRaw) : null;
    const item = text(form?.item).slice(0, 80);
    const message = text(form?.message).replace(/\s+/g, ' ').slice(0, 1000);
    const errors: string[] = [];
    if (name.length < 2 || name.length > 80) errors.push('name: 2 to 80 characters');
    if (!phone) errors.push('phone: a valid mobile number is required');
    if (emailRaw && !email) errors.push('email: not a valid address');
    if (message.length === 1) errors.push('message: 2 to 1000 characters');
    if (!consentGiven(form?.consent)) errors.push('consent: agree to the current text before sending');
    if (errors.length) throw invalid(errors);

    const body = message || NO_MESSAGE;
    const honeypot = text(form?.website);
    const key = await this.keyFor(String(hostIn ?? '').toLowerCase(), phone!, body);
    const kind = item ? 'PRODUCT_ENQUIRY' : 'ENQUIRY';
    const payload = item ? { productRef: item, ...(message ? { message } : {}) } : { message: body };
    const submitBody = {
      kind, payload, name, phone: phone!, email, idempotencyKey: key, website: honeypot || undefined, otp: /^\d{6}$/.test(text(form?.otp)) ? text(form?.otp) : undefined,
      consent: { contactByBusiness: true, contactByPlatform: true, marketing: false, textVersion: s.customerConsentVersion },
    };

    let result;
    try { result = await this.requests.submit(hostIn, submitBody, ip); }
    catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
      return this.hold(hostIn, { key, name, phone: phone!, email, message: body, item: item || null, honeypot: honeypot !== '' });
    }
    if ('otpRequired' in result) return { otpRequired: true, message: result.message };
    // A first, real (not spam, not replayed) request carries a tracking link: only then is the written copy made and the vendor alerted.
    if (result.trackingUrl && !result.replay) await this.copyToInbox(hostIn, result.reference, { key: result.reference, name, phone: phone!, email, message: body, item: item || null });
    return { received: true, reference: result.reference };
  }

  /** The written copy. The request is already stored and visible at /v3/me/requests, so a fault here is logged and never changes what the visitor is told. */
  private async copyToInbox(hostIn: string, reference: string, e: { key: string; name: string; phone: string; email: string | null; message: string; item: string | null }): Promise<void> {
    try {
      const found = await this.requests.lookup(hostIn); if (!found) return;
      const r = await this.inbox.recordWebEnquiry({ id: found.vendorId, email: found.vendor.email }, { ...e, host: found.host, held: false });
      void this.bus?.emit({ type: 'request.received', vendorId: found.vendorId, at: this.clock(), actor: { type: 'SYSTEM', id: null }, data: { requestId: reference, source: 'WEBSITE_FORM', forwardStatus: r.forwardStatus } });
    } catch (err) { this.log.warn(`enquiry copy to the inbox failed: ${err instanceof Error ? err.name : 'error'}`); }
  }

  /** The held rule. Only a business that is otherwise reachable (known host, not suspended, not removed, no takedown) whose plan is NOT active, with both switches on, keeps the enquiry; everything else is the same plain 404. */
  private async hold(hostIn: string, e: { key: string; name: string; phone: string; email: string | null; message: string; item: string | null; honeypot: boolean }): Promise<EnquiryResult> {
    const nothing = (): NotFoundException => new NotFoundException('Not found');
    const found = await this.requests.lookup(hostIn); if (!found) throw nothing();
    if (planActive(await this.ents.resolve(found.vendorId))) throw nothing();   // the plan stands, so the refusal was a missing feature (a Free site): no hold
    const s = await this.mailSettings.get();
    if (!s.heldEnquiriesEnabled || !(await this.consent.enquiryConsentPublished())) throw nothing();
    if (e.honeypot) return { received: true, reference: null };   // a robot: looks accepted, nothing kept
    await this.inbox.recordWebEnquiry({ id: found.vendorId, email: found.vendor.email }, { key: e.key, host: found.host, name: e.name, phone: e.phone, email: e.email, message: e.message, item: e.item, held: true });
    return { received: true, reference: null };   // the visitor is never told the plan is inactive
  }
}
