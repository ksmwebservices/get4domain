import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../prisma/prisma.service';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const TTL_MS = 5 * 60 * 1000; // code valid 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // min gap between sends to one number
const MAX_ATTEMPTS = 5;

/** 'YYYY-MM-DD' for a Date, in Asia/Kolkata (IST, UTC+5:30, no DST) — the calendar-day
 *  key for "one OTP per number per day". No date library needed: Intl with the en-CA
 *  locale formats as YYYY-MM-DD directly. */
function istDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * Phone OTP via Fast2SMS (SmsService).
 *
 * The CODE store is IN-MEMORY (Map) — fine for a single backend instance; codes are
 * short-lived. NOTE: does not survive a restart and is not shared across instances.
 * Swap for Redis / a g4d_ table when scaling horizontally.
 *
 * The "verified today" record (OtpDailyVerification), by contrast, IS DB-backed
 * (dispatch 24-Sep-2026) — an in-memory-only day cap would reset on every deploy/
 * restart and undermine the entire point (cutting Fast2SMS send cost, ~₹5/SMS).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();

  constructor(
    private readonly sms: SmsService,
    private readonly prisma: PrismaService,
  ) {}

  private key(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
  }

  /** Has this number completed OTP verification already today (IST)? Checked fresh
   *  against the DB every call — never trusted from anything the client sends. */
  async wasVerifiedToday(phone: string): Promise<boolean> {
    const key = this.key(phone);
    const rec = await this.prisma.otpDailyVerification.findUnique({ where: { phone: key } });
    return !!rec && istDateKey(rec.verifiedAt) === istDateKey(new Date());
  }

  private async markVerifiedToday(phone: string): Promise<void> {
    const key = this.key(phone);
    await this.prisma.otpDailyVerification.upsert({
      where: { phone: key },
      create: { phone: key, verifiedAt: new Date() },
      update: { verifiedAt: new Date() },
    });
  }

  /**
   * Generate + send a 6-digit code — UNLESS this number already verified earlier
   * today, in which case no SMS goes out at all (`skipOtp: true`); the caller
   * (/leads/demo) accepts this same number without a code, re-checking
   * `wasVerifiedToday` itself server-side rather than trusting this response.
   */
  async request(phone: string): Promise<{ sent: boolean; mock: boolean; error?: string; expiresInSec: number; devCode?: string; skipOtp?: boolean }> {
    const key = this.key(phone);
    if (key.length !== 10) throw new BadRequestException('A valid 10-digit mobile number is required');

    if (await this.wasVerifiedToday(key)) {
      this.logger.log(`[SKIP] ${key} already verified today (IST) — no OTP sent`);
      return { sent: false, mock: false, expiresInSec: 0, skipOtp: true };
    }

    const existing = this.store.get(key);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      throw new BadRequestException('Please wait a few seconds before requesting another code');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.store.set(key, { code, expiresAt: now + TTL_MS, attempts: 0, lastSentAt: now });

    const res = await this.sms.sendOtp(phone, code);
    if (res.mock) this.logger.log(`[MOCK] OTP for ${key} is ${code} (Fast2SMS not configured)`);
    else if (res.status === 'failed') this.logger.error(`OTP send failed for ${key}: ${res.error ?? 'unknown'}`);
    // Opt-in DEV affordance: echo the code in the response ONLY when SMS is not
    // configured (mock) AND OTP_DEV_ECHO=true. Lets the owner test the funnel
    // before Fast2SMS is live. Off by default; never echoes once a key is set.
    const devCode = res.mock && process.env.OTP_DEV_ECHO === 'true' ? code : undefined;
    return { sent: res.status === 'sent', mock: res.mock, error: res.error, expiresInSec: Math.floor(TTL_MS / 1000), devCode };
  }

  /** Verify a code. Consumes it on success and stamps the number as verified-today. */
  async verify(phone: string, code: string): Promise<boolean> {
    const key = this.key(phone);
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      this.store.delete(key);
      throw new BadRequestException('Too many incorrect attempts — request a new code');
    }
    if (entry.code !== code.trim()) {
      entry.attempts += 1;
      return false;
    }
    this.store.delete(key);
    await this.markVerifiedToday(key);
    return true;
  }
}
