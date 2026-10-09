import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { LeadEvent, LeadspaceProfile, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LeadAlertsService } from './alerts.service';
import { clean, summarise, validatePayload } from './goals';
import { EVENT_TYPES, EventType, normalizePhone, phoneHash } from './leadspace.types';
import { LeadOtpService, VENDOR_VERIFY_DEVICE } from './otp.service';
import { LeadPricingService } from './pricing.service';
import { LeadPurseService } from './purse.service';
import { LeadspaceSettingsService } from './settings.service';

export interface CaptureInput {
  slug: string;
  type?: string;
  name: string;
  phone: string;
  payload: unknown;
  otpId: string;
  code: string;
  idempotencyKey?: string;
  source?: string;
  utm?: Record<string, string>;
  deviceId?: string;
  ip?: string;
}
export interface CaptureResult { ok: true; eventId: string; replayed: boolean; message: string }

class WalletTooLow extends Error {}

/**
 * The capture engine. One verified customer event becomes one LeadEvent row and, in the SAME database transaction, one purse debit.
 *  - The page never depends on the wallet: with too little balance the event is captured as HELD (customer sees the same thank-you page),
 *    the vendor sees a count and a masked contact, and the next refill releases the oldest first, debiting at release.
 *  - The price is quoted at capture (a later price change does not touch it) and charged once: the debit key is `lead:<eventId>`.
 *  - The same customer asking for the same thing inside the dedupe window is one lead; inside the auto-credit window it is captured but not charged;
 *    a vendor's own number is never charged.
 */
@Injectable()
export class LeadCaptureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: LeadOtpService,
    private readonly purse: LeadPurseService,
    private readonly pricing: LeadPricingService,
    private readonly settings: LeadspaceSettingsService,
    private readonly alerts: LeadAlertsService,
  ) {}

  /** Step one of a capture: the customer asks for a code. Resolves the page, then the OTP service applies consent, blocklist and the three hourly limits. */
  async requestOtp(i: { slug: string; phone: string; consent: boolean; deviceId?: string; ip?: string }): Promise<{ otpId: string; expiresInSeconds: number; sandbox: boolean }> {
    const profile = await this.prisma.leadspaceProfile.findUnique({ where: { slug: clean(i.slug, 60) } });
    if (!profile || profile.status !== 'PUBLISHED') throw new NotFoundException('This page is not available right now.');
    return this.otp.request({ phone: i.phone, vendorId: profile.vendorId, slug: profile.slug, deviceId: i.deviceId, ip: i.ip, consent: i.consent });
  }

  async capture(i: CaptureInput): Promise<CaptureResult> {
    const profile = await this.prisma.leadspaceProfile.findUnique({ where: { slug: clean(i.slug, 60) } });
    if (!profile || profile.status !== 'PUBLISHED') throw new NotFoundException('This page is not available right now.');
    const type = (i.type ?? profile.goal) as EventType;
    if (!(EVENT_TYPES as readonly string[]).includes(type) || (type !== profile.goal && type !== 'ENQUIRY')) throw new BadRequestException('This page does not take that kind of request.');
    const name = clean(i.name, 80);
    if (name.length < 2) throw new BadRequestException('Enter your name so the business knows who to contact.');
    const payload = validatePayload(type, i.payload);

    const key = clean(i.idempotencyKey, 80) || `otp:${i.otpId}`;
    // A double tap or a retry after a dropped connection: the code was already used for this very event. Only the same phone gets the replay.
    const replay = await this.prisma.leadEvent.findUnique({ where: { vendorId_idempotencyKey: { vendorId: profile.vendorId, idempotencyKey: key } } });
    const ten = normalizePhone(i.phone);
    if (replay && ten && replay.phoneHash === phoneHash(ten)) return this.done(replay, profile, true);

    const checked = await this.otp.check(i.otpId, i.phone, i.code);
    if (checked.vendorId !== profile.vendorId || checked.deviceHash === VENDOR_VERIFY_DEVICE) throw new BadRequestException('That code is not right or has expired. Request a new code and try again.');

    const s = await this.settings.get();
    const now = Date.now();
    const recent = await this.prisma.leadEvent.findMany({
      where: { vendorId: profile.vendorId, phoneHash: checked.phoneHash, type, createdAt: { gte: new Date(now - Math.max(s.autoCreditWindowHours, s.dedupeWindowHours) * 3_600_000) } },
      orderBy: { createdAt: 'desc' }, take: 20,
    });
    const sameShape = (e: LeadEvent): boolean => type !== 'CART_ORDER' || JSON.stringify(e.payload) === JSON.stringify(payload);
    const dup = recent.find((e) => e.createdAt.getTime() >= now - s.dedupeWindowHours * 3_600_000 && sameShape(e));
    if (dup) {
      await this.prisma.leadOtp.updateMany({ where: { id: i.otpId, usedAt: null }, data: { usedAt: new Date() } });
      return this.done(dup, profile, true);
    }

    const vendor = await this.prisma.vendor.findUnique({ where: { id: profile.vendorId }, select: { phone: true } });
    const own = [profile.phone, profile.alertWhatsapp, vendor?.phone].map((p) => normalizePhone(p)).filter(Boolean);
    const autoReason: 'VENDOR_OWN' | 'DUPLICATE' | null = own.includes(checked.ten) ? 'VENDOR_OWN' : type !== 'CART_ORDER' && recent.length > 0 ? 'DUPLICATE' : null;

    const quote = await this.pricing.resolve({ eventType: type, category: profile.category, city: profile.city });
    const price = quote?.pricePaise ?? 0;
    const eventId = crypto.randomUUID();
    let held = false;
    let balanceAfter: number | null = null;

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        if (!(await this.otp.consume(tx, i.otpId))) throw new BadRequestException('That code is not right or has expired. Request a new code and try again.');
        const base: Prisma.LeadEventUncheckedCreateInput = {
          id: eventId, vendorId: profile.vendorId, profileId: profile.id, type, customerName: name, customerPhone: checked.ten, phoneHash: phoneHash(checked.ten),
          payload: payload as Prisma.InputJsonValue, source: i.source ? clean(i.source, 60) : null, utm: i.utm ? (Object.fromEntries(Object.entries(i.utm).slice(0, 8).map(([k, v]) => [clean(k, 30), clean(v, 80)])) as Prisma.InputJsonValue) : undefined,
          consentId: checked.consentId, otpVerifiedAt: new Date(), priceQuotedPaise: quote ? price : null, idempotencyKey: key, orderDecision: type === 'CART_ORDER' ? 'PENDING' : null,
        };
        if (autoReason) {
          const ev = await tx.leadEvent.create({ data: { ...base, status: 'CREDITED', deliveredAt: new Date() } });
          await tx.invalidLeadCredit.create({ data: { leadId: ev.id, vendorId: profile.vendorId, reason: autoReason, decidedBy: 'AUTO', amountPaise: 0, note: autoReason === 'VENDOR_OWN' ? 'Captured from the vendor\'s own number. Not charged.' : 'Repeat request from the same customer inside the credit window. Not charged.' } });
          return ev;
        }
        if (price <= 0) return tx.leadEvent.create({ data: { ...base, status: 'DELIVERED', deliveredAt: new Date() } });
        const d = await this.purse.debit(tx, { vendorId: profile.vendorId, amountPaise: price, reason: 'LEAD_CHARGE', idempotencyKey: `lead:${eventId}`, refType: 'LeadEvent', refId: eventId });
        if (d.ok) {
          balanceAfter = d.balancePaise;
          return tx.leadEvent.create({ data: { ...base, status: 'DELIVERED', deliveredAt: new Date(), priceChargedPaise: price, ledgerId: d.entry?.id ?? null } });
        }
        if (profile.lowBalanceMode === 'REJECT') throw new WalletTooLow();
        held = true;
        return tx.leadEvent.create({ data: { ...base, status: 'HELD' } });
      });
      void this.afterCapture(event, profile, held, balanceAfter, price, s.lowBalanceThresholdsPaise);
      return this.done(event, profile, false);
    } catch (e) {
      if (e instanceof WalletTooLow) throw new HttpException(`${profile.businessName} cannot take new requests through this page right now. Please contact them directly.`, HttpStatus.SERVICE_UNAVAILABLE);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.prisma.leadEvent.findUnique({ where: { vendorId_idempotencyKey: { vendorId: profile.vendorId, idempotencyKey: key } } });
        if (again) return this.done(again, profile, true);
      }
      throw e;
    }
  }

  private done(ev: LeadEvent, profile: LeadspaceProfile, replayed: boolean): CaptureResult {
    // The customer sees the same page whether the lead was delivered or held.
    return { ok: true, eventId: ev.id, replayed, message: `Thank you, ${ev.customerName.split(' ')[0]}. ${profile.businessName} has your request and will contact you soon.` };
  }

  private async afterCapture(ev: LeadEvent, profile: LeadspaceProfile, held: boolean, balanceAfter: number | null, price: number, thresholds: number[]): Promise<void> {
    try {
      const detail = summarise(ev.type as EventType, ev.payload as Record<string, unknown>);
      if (held) {
        await this.alerts.held(ev.vendorId, await this.prisma.leadEvent.count({ where: { vendorId: ev.vendorId, status: 'HELD' } }));
        return;
      }
      await this.alerts.newLead(ev, profile, detail);
      if (balanceAfter !== null) {
        const before = balanceAfter + price;
        const crossed = thresholds.filter((t) => before >= t && balanceAfter < t);
        if (crossed.length || balanceAfter === 0) await this.alerts.lowBalance(ev.vendorId, balanceAfter);
      }
    } catch { /* alerts never fail a capture */ }
  }

  /**
   * After a refill (or on an admin's request): release held customers oldest first. Each release is its own transaction that flips the status
   * and debits the quoted price; the first one the wallet cannot pay stops the run, so the order is strict.
   */
  async releaseHeld(vendorId: string): Promise<{ released: number; stillHeld: number; balancePaise: number }> {
    const profile = await this.prisma.leadspaceProfile.findUnique({ where: { vendorId } });
    let released = 0;
    for (let guard = 0; guard < 500; guard++) {
      const next = await this.prisma.leadEvent.findFirst({ where: { vendorId, status: 'HELD' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      if (!next) break;
      const price = next.priceQuotedPaise ?? 0;
      try {
        const ev = await this.prisma.$transaction(async (tx) => {
          const flip = await tx.leadEvent.updateMany({ where: { id: next.id, status: 'HELD' }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
          if (flip.count !== 1) return null;
          if (price > 0) {
            const d = await this.purse.debit(tx, { vendorId, amountPaise: price, reason: 'LEAD_CHARGE', idempotencyKey: `lead:${next.id}`, refType: 'LeadEvent', refId: next.id });
            if (!d.ok) throw new WalletTooLow();
            return tx.leadEvent.update({ where: { id: next.id }, data: { priceChargedPaise: price, ledgerId: d.entry?.id ?? null } });
          }
          return tx.leadEvent.findUniqueOrThrow({ where: { id: next.id } });
        });
        if (ev) {
          released++;
          if (profile) void this.alerts.newLead(ev, profile, summarise(ev.type as EventType, ev.payload as Record<string, unknown>)).catch(() => undefined);
        }
      } catch (e) {
        if (e instanceof WalletTooLow) break;
        throw e;
      }
    }
    if (released) await this.alerts.released(vendorId, released);
    return { released, stillHeld: await this.prisma.leadEvent.count({ where: { vendorId, status: 'HELD' } }), balancePaise: await this.purse.balance(vendorId) };
  }
}
