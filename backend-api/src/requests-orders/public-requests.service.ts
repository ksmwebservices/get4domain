import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { b3Error } from '../b3-settings/b3-errors';
import { B3Settings } from '../b3-settings/b3-settings';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { evaluateAttempt, generateOtp, hashCode, hashPhone, normalisePhoneE164, verifyCodeHash } from '../directory/core/otp';
import { DirectoryVisitService } from '../directory/directory-visit.service';
import { DirectoryRepository } from '../directory/directory.repository';
import { OtpPepper } from '../directory/pepper';
import { DirectorySettingsService } from '../directory/settings/directory-settings.service';
import { SmsAdapter } from '../directory/sms/sms-adapter';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { normaliseEmail } from '../provisioning/steps/business-input';
import { ProhibitedScanPort, TakedownPort } from '../v3-trust/trust.ports';
import { HostDirectory } from '../site-domains/host-directory';
import { normaliseHostname } from '../site-domains/core/hostname';
import { LifecycleStore } from '../vendor-lifecycle/lifecycle.store';
import { isVendorOfferedKind } from '../v3-payments/core/method-core';
import { MethodKind, offerProblem, paymentReadiness, priceCart } from './core/commerce-core';
import { addressHash } from './core/messaging-core';
import { consentTextHash, consentValid, duplicateKey, expiresAtFor, hashTrackingToken, newTrackingToken, PUBLIC_KINDS, RequestKind, spamDecision, spamScore, validatePayload, looksLikeTrackingToken } from './core/requests-core';
import { MessagingService } from './messaging.service';
import { Catalogue, OwnGatewayGate } from './requests-ports';
import { NewRequest, OfferUsedUp, PaymentMode, RequestRow, RequestsStore, StockUnavailable } from './requests.store';

/** One answer for every host that must reveal nothing: unknown, removed, suspended, Free, seeded, or a site without the features. */
const nothing = (): NotFoundException => new NotFoundException('Not found');
const invalid = (errors: string[]): BadRequestException => new BadRequestException(b3Error('REQUEST_INVALID', 'Some details are missing or not valid.', { errors }));
const KEY = /^[A-Za-z0-9._-]{16,80}$/;

export interface Common {
  name: string; phone: string; email: string | null; idempotencyKey: string; website?: unknown; otp?: string; consent?: unknown; utm?: { source?: string; medium?: string; campaign?: string }; dirRef?: string;
}
export interface SubmitBody extends Common { kind: string; payload: unknown }
export interface OrderBody extends Common { items: Array<{ productRef: string; qty: number }>; couponCode?: string; payWith?: 'ONLINE' | 'COD' | 'AT_VISIT' | 'MANUAL'; shipping?: { address?: string; city?: string; pincode?: string } }
interface Prepared {
  s: B3Settings; now: Date; name: string; phone: string; email: string | null; consent: { contactByBusiness: boolean; contactByPlatform: boolean; marketing: boolean }; ipHash: string | null;
  spam: { score: number; reasons: string[] }; decision: 'ACCEPT' | 'ASK_OTP' | 'BLOCK';
}
type Gate = { vendorId: string; vendor: { businessName: string; phone: string | null; email: string }; host: string };
export type SubmitResult =
  | { accepted: true; reference: string; status: string; trackingUrl?: string; replay?: true }
  | { otpRequired: true; message: string };

/**
 * The public side of the bridge. EVERY route resolves the host through the domain service and requires a Pro site with calls to action, the requests inbox (and the cart for orders) and a vendor that is
 * not suspended or removed: anything else is one plain 404, so a Free, seeded, suspended or unknown site reveals nothing. Requests are idempotent per vendor and key, rate limited at the route, scored for
 * spam, and carry the customer's consent for the current text version. Money is never touched here: an order only records what the customer chose and returns the vendor's own checkout reference.
 */
@Injectable()
export class PublicRequestsService {
  clock: () => Date = () => new Date();
  random: (min: number, max: number) => number = (min, max) => randomInt(min, max);
  salt: () => string = () => Math.random().toString(36).slice(2);

  constructor(
    private readonly store: RequestsStore, @Inject(HostDirectory) private readonly hosts: Pick<HostDirectory, 'resolveHost'>, @Inject(EntitlementsService) private readonly ents: Pick<EntitlementsService, 'resolve'>, private readonly lifecycle: LifecycleStore,
    private readonly directory: DirectoryRepository, @Inject(DirectoryVisitService) private readonly visits: Pick<DirectoryVisitService, 'attribute'>, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>,
    private readonly pepper: OtpPepper, private readonly messaging: MessagingService, private readonly catalogue: Catalogue, private readonly gateway: OwnGatewayGate, private readonly sms: SmsAdapter,
    @Inject(DirectorySettingsService) private readonly dirSettings: Pick<DirectorySettingsService, 'get'>, @Optional() @Inject('PUBLIC_APP_URL') private readonly appUrl: string = 'https://app.get4domain.invalid',
    /** slice 5.21: a legal takedown stops forms and checkout at once; the scan looks at what a customer wrote (it never blocks) */
    @Optional() @Inject(TakedownPort) private readonly takedowns?: TakedownPort, @Optional() @Inject(ProhibitedScanPort) private readonly scan?: ProhibitedScanPort,
  ) {}

  // ── the gate ──
  private async gate(hostIn: string, needs: string[]) {
    const host = normaliseHostname(String(hostIn ?? ''));
    if (!host) throw nothing();
    const r = await this.hosts.resolveHost(host);
    if (!r) throw nothing();
    const vendor = await this.lifecycle.vendor(r.vendorId);
    if (!vendor || vendor.status === 'SUSPENDED' || (await this.lifecycle.isRemoved(r.vendorId))) throw nothing();
    if (this.takedowns && (await this.takedowns.activeForVendor(r.vendorId))) throw nothing();   // a legal takedown: the site shows a notice, so nothing can be sent to it   // read fresh each time: suspension stops forms and checkout AT ONCE
    const e = await this.ents.resolve(r.vendorId);
    for (const k of ['site.cta', 'requests.inbox', ...needs]) if (e.features[k]?.state !== 'ACTIVE') throw nothing();
    return { vendorId: r.vendorId, vendor, host };
  }

  // ── what both routes share ──
  private async prepare(vendorId: string, host: string, b: Common, kind: RequestKind, payload: Record<string, unknown>, ip: string | null, orderTotalText: string): Promise<{ replay: SubmitResult } | { replay?: undefined; p: Prepared }> {
    const s = await this.b3.get(); const now = this.clock(); const pepper = this.pepper.value();
    const errors: string[] = [];
    const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''; if (name.length < 2 || name.length > 80) errors.push('name: 2 to 80 characters');
    const phone = typeof b.phone === 'string' ? normalisePhoneE164(b.phone) : null; if (!phone) errors.push('phone: a valid mobile number is required');
    let email: string | null = null; if (typeof b.email === 'string' && b.email.trim() !== '') { email = normaliseEmail(b.email); if (!email) errors.push('email: not a valid address'); }
    if (typeof b.idempotencyKey !== 'string' || !KEY.test(b.idempotencyKey)) errors.push('idempotencyKey: 16 to 80 letters, digits, dots, dashes or underscores');
    if (!consentValid(b.consent as never, s.customerConsentVersion)) errors.push('consent: agree to the current text before sending');
    if (errors.length) throw invalid(errors);
    const consent = b.consent as { contactByBusiness: boolean; contactByPlatform: boolean; marketing: boolean };

    const replay = await this.store.findByIdempotency(vendorId, b.idempotencyKey);
    if (replay) return { replay: { accepted: true as const, reference: replay.id, status: replay.status === 'SPAM' ? 'RECEIVED' : replay.status, replay: true as const } };

    const phoneHash = hashPhone(phone!, pepper); const ipHash = this.pepper.hashIp(ip); const emailHash = email ? addressHash('EMAIL', email, pepper) : null;
    const blocked = (await this.store.isBlocked('PHONE_HASH', phoneHash)) || (ipHash !== null && (await this.store.isBlocked('IP_HASH', ipHash))) || (emailHash !== null && (await this.store.isBlocked('EMAIL_HASH', emailHash)));
    const hour = new Date(now.getTime() - 3_600_000);
    const dup = await this.store.findRecentDuplicate(vendorId, phone!, kind, payload, new Date(now.getTime() - s.requestDuplicateWindowMinutes * 60_000));
    const spam = spamScore({ honeypot: b.website, blocked, duplicateRecent: !!dup, fromPhoneLastHour: await this.store.countRecentByPhone(vendorId, phone!, hour), fromIpLastHour: ipHash ? await this.store.countRecentByIp(ipHash, hour) : 0, text: JSON.stringify(payload) + orderTotalText });
    const decision = spamDecision(spam.score, { otp: s.spamScoreOtpThreshold, block: s.spamScoreBlockThreshold });
    void duplicateKey;   // the duplicate itself is found by the store (same sender, kind and payload inside the window)
    return { p: { s, now, name, phone: phone!, email, consent, ipHash, spam, decision } };
  }

  /** The optional phone code (slice 5.7 OTP core) asked when the spam score is high. Returns true when the right code was given. */
  private async otpGate(vendorId: string, idempotencyKey: string, phone: string, code: string | undefined, ip: string | null): Promise<boolean> {
    const subject = `${vendorId}:${idempotencyKey}`; const pepper = this.pepper.value(); const now = this.clock();
    if (code) {
      const ch = await this.directory.latestChallenge('REQUEST', subject);
      if (!ch) { hashCode('000000', 'x', pepper); return false; }
      const res = evaluateAttempt(ch, now, verifyCodeHash(code, ch.codeHash, ch.salt, pepper));
      if (res.result === 'OK') return this.directory.applyAttempt(ch.id, ch.attempts, { attempts: res.attempts, status: 'VERIFIED', usedAt: now });
      if (res.result === 'WRONG' || res.result === 'LOCKED') await this.directory.applyAttempt(ch.id, ch.attempts, { attempts: res.attempts, status: res.result === 'LOCKED' ? 'LOCKED' : 'PENDING', usedAt: null });
      return false;
    }
    const ds = await this.dirSettings.get(); const last = await this.directory.latestChallenge('REQUEST', subject);
    if (last && now.getTime() - last.createdAt.getTime() < ds.otpResendCooldownSeconds * 1000) return false;
    const otp = generateOtp(this.random); const salt = this.salt(); const phoneHash = hashPhone(phone, pepper);
    const body = `Your Get4Domain code to confirm your request is ${otp}. It expires in ${ds.otpExpiryMinutes} minutes. Do not share it.`;
    const sandbox = await this.sms.isSandbox();
    await this.directory.revokePendingChallenges('REQUEST', subject);
    await this.directory.createChallenge({ subjectType: 'REQUEST', subjectId: subject, channel: 'SMS', phoneHash, codeHash: hashCode(otp, salt, pepper), salt, maxAttempts: ds.otpMaxAttempts, expiresAt: new Date(now.getTime() + ds.otpExpiryMinutes * 60_000), requestIpHash: this.pepper.hashIp(ip), sandboxBody: sandbox ? body : null });
    try { await this.sms.send(phone, body); } catch { /* the challenge stays; the visitor can ask again after the cooldown */ }
    return false;
  }

  private async attribution(vendorId: string, ref: string | undefined): Promise<{ source: 'DIRECTORY' | 'SITE'; hash: string | null }> {
    if (!ref) return { source: 'SITE', hash: null };
    const biz = await this.directory.getBusinessByVendor(vendorId);
    if (biz && (await this.visits.attribute(ref, biz.id))) return { source: 'DIRECTORY', hash: addressHash('EMAIL', ref, this.pepper.value()).slice(0, 32) };   // only a derived hash is kept; the reference itself is never stored
    return { source: 'SITE', hash: null };
  }

  private async deliver(row: RequestRow, vendor: { businessName: string; phone: string | null; email: string }, token: string | null, customer: { name: string; phone: string; email: string | null }) {
    const url = token ? `${this.appUrl.replace(/\/+$/, '')}/track/${token}` : '';
    const vars = { customerName: customer.name, businessName: vendor.businessName, reference: row.id, trackingUrl: url };
    await this.messaging.send({ vendorId: row.vendorId, to: { phone: customer.phone, email: customer.email }, templateKey: 'request_received_customer', vars, relatedRequestId: row.id, bridge: true });
    const toVendor = await this.messaging.send({ vendorId: row.vendorId, to: { phone: vendor.phone, email: vendor.email }, templateKey: 'request_received_vendor', vars, relatedRequestId: row.id });
    await this.store.transition(row.id, 'RECEIVED', 'DELIVERED', {}, { type: 'DELIVERED', actorType: 'SYSTEM', channel: toVendor.channel, deliveryResult: toVendor.status });
  }

  // ── POST /v3/public/sites/:host/requests ──
  async submit(hostIn: string, body: SubmitBody, ip: string | null): Promise<SubmitResult> {
    const g = await this.gate(hostIn, []);
    const kind = String(body?.kind ?? '').toUpperCase() as RequestKind;
    if (!PUBLIC_KINDS.includes(kind)) throw invalid(['kind: ENQUIRY, APPOINTMENT, QUOTE or PRODUCT_ENQUIRY']);
    const v = validatePayload(kind, body.payload); if (!v.ok) throw invalid(v.errors);
    const prep = await this.prepare(g.vendorId, g.host, body, kind, v.payload, ip, '');
    if (prep.replay) return prep.replay;
    return this.create(g, body, kind, v.payload, prep.p, ip, null);
  }

  private async create(g: Gate, body: Common, kind: RequestKind, payload: Record<string, unknown>, x: Prepared, ip: string | null, order: { make: (n: NewRequest) => Promise<{ request: RequestRow; extra: Record<string, unknown> }> } | null): Promise<SubmitResult> {
    if (x.decision === 'ASK_OTP' && !(await this.otpGate(g.vendorId, body.idempotencyKey, x.phone, body.otp, ip))) return { otpRequired: true, message: 'We sent a code to your phone. Enter it to send your request.' };
    const blocked = x.decision === 'BLOCK';
    const token = blocked ? null : newTrackingToken(randomBytes);
    const attr = blocked ? { source: 'SITE' as const, hash: null } : await this.attribution(g.vendorId, body.dirRef);
    const nr: NewRequest = {
      vendorId: g.vendorId, siteHost: g.host, kind, status: blocked ? 'SPAM' : 'RECEIVED', customerName: x.name, customerPhoneE164: x.phone, customerEmail: x.email, payload, sourceKind: attr.source, directoryRefHash: attr.hash,
      utmSource: body.utm?.source?.slice(0, 80) ?? null, utmMedium: body.utm?.medium?.slice(0, 80) ?? null, utmCampaign: body.utm?.campaign?.slice(0, 80) ?? null, idempotencyKey: body.idempotencyKey, spamScore: x.spam.score,
      expiresAt: expiresAtFor(x.now, x.s.requestExpiryDays),
      consent: { textVersion: x.s.customerConsentVersion, textHash: consentTextHash(x.s.customerConsentText), ipHash: x.ipHash, contactByBusiness: true, contactByPlatform: x.consent.contactByPlatform, marketing: x.consent.marketing },
      trackingTokenHash: token ? hashTrackingToken(token) : null, trackingExpiresAt: token ? new Date(x.now.getTime() + x.s.trackingTokenExpiryDays * 86_400_000) : null,
      events: [{ type: blocked ? 'SPAM_STORED' : 'RECEIVED', actorType: 'CUSTOMER', meta: blocked ? { reasons: x.spam.reasons, score: x.spam.score } : { source: attr.source } }],
    };
    let row: RequestRow; let extra: Record<string, unknown> = {};
    try {
      if (order) ({ request: row, extra } = await order.make(nr)); else row = await this.store.createRequest(nr);
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') { const again = await this.store.findByIdempotency(g.vendorId, body.idempotencyKey); if (again) return { accepted: true, reference: again.id, status: again.status === 'SPAM' ? 'RECEIVED' : again.status, replay: true }; }
      throw e;
    }
    if (blocked) return { accepted: true, reference: row.id, status: 'RECEIVED' };   // looks exactly like an accepted request; nothing is delivered and nothing can be tracked
    await this.deliver(row, g.vendor, token, { name: x.name, phone: x.phone, email: x.email });
    await this.scanText(g.vendorId, x.name, payload);
    const trackingUrl = `${this.appUrl.replace(/\/+$/, '')}/track/${token}`;
    return { accepted: true, reference: row.id, status: 'DELIVERED', trackingUrl, ...extra } as SubmitResult;
  }

  /** Owner rule 11: what the customer wrote is looked at for prohibited phrases. A match raises an alert; the request has already been accepted and is never refused for it. */
  private async scanText(vendorId: string, name: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.scan) return;
    const texts: string[] = [name];
    const walk = (v: unknown, depth: number): void => { if (typeof v === 'string') texts.push(v); else if (depth < 3 && v && typeof v === 'object') for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1); };
    walk(payload, 0);
    try { await this.scan.scan(vendorId, 'REQUEST', texts); } catch { /* the request is already stored and delivered; a scan fault never changes the answer */ }
  }

  // ── POST /v3/public/sites/:host/orders ──
  async order(hostIn: string, body: OrderBody, ip: string | null): Promise<SubmitResult> {
    const g = await this.gate(hostIn, ['shop.cart']);
    const methods = (await this.store.listMethods(g.vendorId)).filter((m) => isVendorOfferedKind(m.kind));   // gateway rows are never offered (amendment 06)
    const readiness = paymentReadiness(methods);
    if (readiness === 'ENQUIRY_ONLY') throw new ConflictException(b3Error('ORDER_INVALID', 'This shop is not taking orders online. Please send an enquiry instead.', { readiness }));
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length || items.length > 50 || items.some((i) => !i || typeof i.productRef !== 'string' || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 1000)) throw invalid(['items: 1 to 50 lines, each with a productRef and a whole quantity']);
    const lines = []; const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.productRef)) throw invalid([`items: ${it.productRef} appears twice`]); seen.add(it.productRef);
      const c = await this.catalogue.find(g.vendorId, it.productRef);
      if (!c) throw invalid([`items: ${it.productRef.slice(0, 40)} is not available`]);
      lines.push({ productRef: c.productRef, name: c.name, unitPaise: c.unitPaise, qty: it.qty, taxPercent: c.taxPercent });
    }
    let offer = null; let offerId: string | null = null;
    if (body.couponCode) {
      const o = await this.store.offerByCode(g.vendorId, String(body.couponCode).slice(0, 40));
      if (!o || o.kind !== 'COUPON') throw invalid(['couponCode: not valid']);
      const sub = lines.reduce((n, l) => n + l.unitPaise * l.qty, 0);
      const problem = offerProblem(o, sub, this.clock()); if (problem) throw invalid([`couponCode: ${problem}`]);
      offer = o; offerId = o.id;
    }
    const cart = priceCart(lines, offer, this.clock());
    const payWith = body.payWith ?? (readiness === 'FULL_CHECKOUT' ? 'ONLINE' : 'COD');
    let mode: PaymentMode; let methodId: string | null = null; let method: (typeof methods)[number] | undefined;
    if (payWith === 'ONLINE') {
      if (readiness !== 'FULL_CHECKOUT') throw new ConflictException(b3Error('ORDER_INVALID', 'Online payment is not available here.', { readiness }));
      method = methods.find((m) => m.status === 'ACTIVE' && m.kind === 'UPI')!; mode = 'ONLINE'; methodId = method.id;
    } else {
      const want: MethodKind = payWith === 'COD' ? 'PAY_ON_DELIVERY' : payWith === 'AT_VISIT' ? 'PAY_AT_VISIT' : 'BANK_TRANSFER';
      method = methods.find((m) => m.status === 'ACTIVE' && m.kind === want);
      if (!method) throw new ConflictException(b3Error('ORDER_INVALID', 'That way of paying is not offered.', { readiness }));
      mode = payWith as PaymentMode; methodId = method.id;
    }
    const sh = body.shipping ?? {};
    const shipping = { address: String(sh.address ?? '').slice(0, 300), city: String(sh.city ?? '').slice(0, 80), pincode: String(sh.pincode ?? '').slice(0, 10) };
    const payload = { items: cart.lines.map((l) => ({ productRef: l.productRef, qty: l.qty })), couponCode: cart.offerCode, totalPaise: cart.totalPaise };
    const prep = await this.prepare(g.vendorId, g.host, body, mode === 'ONLINE' ? 'ORDER' : 'ORDER_REQUEST', payload, ip, '');
    if (prep.replay) return prep.replay;
    const s = prep.p.s;
    const make = async (nr: NewRequest) => {
      try {
        const placed = await this.store.placeOrder({
          request: nr, paymentMode: mode, methodId, amountPaise: cart.totalPaise, currency: 'INR', shipping,
          items: cart.lines.map((l) => ({ productRef: l.productRef, name: l.name, qty: l.qty, unitPaise: l.unitPaise, tax: { percent: l.taxPercent, taxPaise: l.taxPaise, discountPaise: l.discountPaise } })), offerId,
          reserveUntil: new Date(this.clock().getTime() + s.stockReservationMinutes * 60_000),
        });
        const extra: Record<string, unknown> = { orderNo: placed.order.orderNo, totalPaise: cart.totalPaise, paymentMode: mode, readiness };
        extra.paymentStep = mode === 'ONLINE' ? { step: 'PAY_ONLINE_WITH_VENDOR_GATEWAY', checkout: await this.gateway.get().createCheckout({ orderId: placed.order.id, orderNo: placed.order.orderNo, amountPaise: cart.totalPaise, currency: 'INR', kind: method!.kind, last4: method!.last4 }) } : { step: mode === 'COD' ? 'PAY_ON_DELIVERY' : mode === 'AT_VISIT' ? 'PAY_AT_THE_VISIT' : 'PAY_AS_THE_BUSINESS_ARRANGES' };
        return { request: placed.request, extra };
      } catch (e) {
        if (e instanceof StockUnavailable) throw new ConflictException(b3Error('STOCK_UNAVAILABLE', 'One of the items is out of stock.', { productRef: e.productRef }));
        if (e instanceof OfferUsedUp) throw new ConflictException(b3Error('OFFER_INVALID', 'That coupon has been used up.'));
        throw e;
      }
    };
    return this.create(g, body, mode === 'ONLINE' ? 'ORDER' : 'ORDER_REQUEST', payload, prep.p, ip, { make });
  }

  // ── GET /v3/public/requests/track/:token ──
  async track(token: string) {
    if (!looksLikeTrackingToken(token)) { hashTrackingToken('x'.repeat(43)); throw nothing(); }
    const hit = await this.store.trackingByHash(hashTrackingToken(token));
    if (!hit || hit.expiresAt.getTime() <= this.clock().getTime() || hit.request.status === 'SPAM') throw nothing();   // wrong, expired and spam look identical
    const r = hit.request; const s = await this.b3.get();
    const vendor = await this.lifecycle.vendor(r.vendorId);
    if (!vendor || (await this.lifecycle.isRemoved(r.vendorId))) throw nothing();
    const events = (await this.store.events(r.id)).filter((e) => e.type === 'VENDOR_REPLY' || e.type === 'STATUS').map((e) => ({ at: e.at, type: e.type, message: typeof e.meta.message === 'string' ? e.meta.message : undefined, status: typeof e.meta.status === 'string' ? e.meta.status : undefined }));
    const ord = r.kind === 'ORDER' || r.kind === 'ORDER_REQUEST' ? await this.store.orderByRequest(r.id) : null;
    return {
      reference: r.id, kind: r.kind, status: r.status, createdAt: r.createdAt, business: vendor.businessName, replies: events,
      order: ord ? { orderNo: ord.order.orderNo, status: ord.order.status, totalPaise: ord.order.amountPaise, currency: ord.order.currency, paymentMode: ord.order.paymentMode, tracking: ord.order.tracking } : null,
      statement: s.trackingBridgeText,
    };
  }

  // ── POST /v3/public/reports ──
  async report(b: { host: string; reasonKind?: string; text?: string; contact?: string }) {
    const host = normaliseHostname(String(b?.host ?? '')) ?? String(b?.host ?? '').slice(0, 253);
    const reasons = ['SCAM', 'WRONG_INFORMATION', 'NOT_A_REAL_BUSINESS', 'INAPPROPRIATE', 'OTHER'];
    const reasonKind = reasons.includes(String(b?.reasonKind)) ? String(b.reasonKind) : 'OTHER';
    const contact = typeof b?.contact === 'string' ? b.contact.trim() : '';
    const masked = contact.includes('@') ? `${contact.slice(0, 1)}•••@${contact.split('@')[1]?.slice(0, 60) ?? ''}` : contact ? `${contact.slice(0, 3)}•••${contact.slice(-2)}` : null;
    await this.store.createReport({ reportedHost: String(host).slice(0, 253), reasonKind, text: String(b?.text ?? '').trim().slice(0, 500), reporterContactMasked: masked });
    return { received: true };   // the same answer whether the host exists, whether the text was empty, whatever
  }
}
