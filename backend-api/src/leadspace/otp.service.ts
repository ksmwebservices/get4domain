import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappGatewayService } from '../messaging/whatsapp/whatsapp-gateway.service';
import { CONSENT_TEXT_VERSION } from './goals';
import { hashOf, normalizePhone, phoneHash } from './leadspace.types';
import { LeadspaceSettingsService } from './settings.service';

const tooMany = (sentence: string): HttpException => new HttpException(sentence, HttpStatus.TOO_MANY_REQUESTS);

/** Marker stored in LeadOtp.deviceHash for codes that prove a vendor owns their number. Such a code can never be used to capture a customer event. */
export const VENDOR_VERIFY_DEVICE = 'vendor-verify';

export interface OtpRequestInput { phone: string; vendorId: string; slug: string; deviceId?: string | null; ip?: string | null; consent: boolean }
export interface OtpRequestResult { otpId: string; expiresInSeconds: number; sandbox: boolean }

/**
 * One-time codes for customers, sent over the common Get4Domain WhatsApp number (authentication template only).
 * Rules in code: consent is required and recorded; only a hash of the code is stored; limits per phone, per device and per IP per hour;
 * no code to a blocked number; a vendor whose codes are mostly never used is flagged and cut off for the day.
 */
@Injectable()
export class LeadOtpService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: WhatsappGatewayService, private readonly settings: LeadspaceSettingsService) {}

  private codeHash = (otpId: string, code: string): string => hashOf(`otp:${otpId}:${code}`);

  async request(i: OtpRequestInput): Promise<OtpRequestResult> {
    if (!i.consent) throw new BadRequestException('Please tick the box to agree before we send a code.');
    const ten = normalizePhone(i.phone);
    if (!ten) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    const s = await this.settings.get();
    const ph = phoneHash(ten);
    if (await this.prisma.leadBlockedPhone.findUnique({ where: { phoneHash: ph } })) throw new BadRequestException('We cannot send a code to this number. Please use another number or contact the business directly.');

    const hourAgo = new Date(Date.now() - 3_600_000);
    const dh = i.deviceId ? hashOf(`d:${i.deviceId}`) : null;
    const ih = i.ip ? hashOf(`i:${i.ip}`) : null;
    if ((await this.prisma.leadOtp.count({ where: { phoneHash: ph, createdAt: { gte: hourAgo } } })) >= s.otpPerPhonePerHour) throw tooMany('Too many codes were requested for this number. Please wait an hour and try again.');
    if (dh && (await this.prisma.leadOtp.count({ where: { deviceHash: dh, createdAt: { gte: hourAgo } } })) >= s.otpPerDevicePerHour) throw tooMany('Too many codes were requested from this device. Please wait an hour and try again.');
    if (ih && (await this.prisma.leadOtp.count({ where: { ipHash: ih, createdAt: { gte: hourAgo } } })) >= s.otpPerIpPerHour) throw tooMany('Too many codes were requested from this network. Please wait an hour and try again.');

    // A vendor page used to spam: many codes sent in a day that nobody entered.
    const dayAgo = new Date(Date.now() - 86_400_000);
    const sentToday = await this.prisma.leadOtp.count({ where: { vendorId: i.vendorId, createdAt: { gte: dayAgo } } });
    if (sentToday >= s.vendorSpamOtpPerDay) {
      const used = await this.prisma.leadOtp.count({ where: { vendorId: i.vendorId, createdAt: { gte: dayAgo }, usedAt: { not: null } } });
      if (used / Math.max(sentToday, 1) < 0.1) throw tooMany('This page cannot send more codes today. Please contact the business directly.');
    }

    const otpId = crypto.randomUUID();
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const consent = await this.prisma.consentRecord.create({ data: { phoneHash: ph, textVersion: CONSENT_TEXT_VERSION, purpose: 'LEAD_CONTACT', vendorId: i.vendorId, slug: i.slug, ipHash: ih } });
    await this.prisma.leadOtp.create({
      data: { id: otpId, phoneHash: ph, codeHash: this.codeHash(otpId, code), vendorId: i.vendorId, consentId: consent.id, deviceHash: dh, ipHash: ih, expiresAt: new Date(Date.now() + s.otpTtlMinutes * 60_000) },
    });
    const sent = await this.gateway.send({ template: 'leadspace_otp', phone: ten, variables: [code], vendorId: i.vendorId });
    if (sent.status === 'REFUSED' || sent.status === 'FAILED') {
      await this.prisma.leadOtp.update({ where: { id: otpId }, data: { usedAt: new Date() } });
      throw new HttpException('We could not send the code just now. Please try again in a minute, or contact the business directly.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { otpId, expiresInSeconds: s.otpTtlMinutes * 60, sandbox: this.gateway.getProvider().sandbox };
  }

  /** A vendor proves they own the number their alerts go to. Same limits per phone and the same blocklist; no consent record is needed. */
  async requestForVendor(vendorId: string, phone: string): Promise<OtpRequestResult> {
    const ten = normalizePhone(phone);
    if (!ten) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    const s = await this.settings.get();
    const ph = phoneHash(ten);
    if (await this.prisma.leadBlockedPhone.findUnique({ where: { phoneHash: ph } })) throw new BadRequestException('We cannot send a code to this number. Please use another number.');
    const hourAgo = new Date(Date.now() - 3_600_000);
    if ((await this.prisma.leadOtp.count({ where: { phoneHash: ph, createdAt: { gte: hourAgo } } })) >= s.otpPerPhonePerHour) throw tooMany('Too many codes were requested for this number. Please wait an hour and try again.');
    const otpId = crypto.randomUUID();
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.leadOtp.create({ data: { id: otpId, phoneHash: ph, codeHash: this.codeHash(otpId, code), vendorId, deviceHash: VENDOR_VERIFY_DEVICE, expiresAt: new Date(Date.now() + s.otpTtlMinutes * 60_000) } });
    const sent = await this.gateway.send({ template: 'leadspace_otp', phone: ten, variables: [code], vendorId });
    if (sent.status === 'REFUSED' || sent.status === 'FAILED') {
      await this.prisma.leadOtp.update({ where: { id: otpId }, data: { usedAt: new Date() } });
      throw new HttpException('We could not send the code just now. Please try again in a minute.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { otpId, expiresInSeconds: s.otpTtlMinutes * 60, sandbox: this.gateway.getProvider().sandbox };
  }

  /** Confirms the vendor's code and returns the verified ten-digit number. */
  async confirmForVendor(vendorId: string, otpId: string, phone: string, code: string): Promise<string> {
    const c = await this.check(otpId, phone, code);
    if (c.vendorId !== vendorId || c.deviceHash !== VENDOR_VERIFY_DEVICE) throw new BadRequestException('That code is not right or has expired. Request a new code and try again.');
    if (!(await this.consume(this.prisma, otpId))) throw new BadRequestException('That code is not right or has expired. Request a new code and try again.');
    return c.ten;
  }

  /** Checks a code without consuming it. A wrong code counts as an attempt; too many attempts burn the code. */
  async check(otpId: string, phone: string, code: string): Promise<{ consentId: string | null; vendorId: string | null; phoneHash: string; ten: string; deviceHash: string | null }> {
    const ten = normalizePhone(phone);
    if (!ten) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    const s = await this.settings.get();
    const row = await this.prisma.leadOtp.findUnique({ where: { id: otpId } });
    const ph = phoneHash(ten);
    const bad = new BadRequestException('That code is not right or has expired. Request a new code and try again.');
    if (!row || row.phoneHash !== ph || row.usedAt || row.expiresAt < new Date()) throw bad;
    if (row.attempts >= s.otpMaxAttempts) throw new BadRequestException('Too many wrong attempts. Request a new code and try again.');
    const ok = /^\d{6}$/.test(code) && crypto.timingSafeEqual(Buffer.from(this.codeHash(otpId, code)), Buffer.from(row.codeHash));
    if (!ok) {
      await this.prisma.leadOtp.update({ where: { id: otpId }, data: { attempts: { increment: 1 } } });
      throw bad;
    }
    return { consentId: row.consentId, vendorId: row.vendorId, phoneHash: ph, ten, deviceHash: row.deviceHash };
  }

  /** Inside the capture transaction: use the code exactly once. */
  async consume(tx: Pick<PrismaService, 'leadOtp'>, otpId: string): Promise<boolean> {
    const r = await tx.leadOtp.updateMany({ where: { id: otpId, usedAt: null }, data: { usedAt: new Date() } });
    return r.count === 1;
  }

  async block(ten: string, reason: string): Promise<void> {
    const ph = phoneHash(normalizePhone(ten) ?? ten);
    await this.prisma.leadBlockedPhone.upsert({ where: { phoneHash: ph }, create: { phoneHash: ph, reason }, update: { reason } });
  }

  async unblock(ten: string): Promise<void> {
    await this.prisma.leadBlockedPhone.deleteMany({ where: { phoneHash: phoneHash(normalizePhone(ten) ?? ten) } });
  }
}
