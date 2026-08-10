import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SmsService } from '../sms/sms.service';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const TTL_MS = 5 * 60 * 1000; // code valid 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // min gap between sends to one number
const MAX_ATTEMPTS = 5;

/**
 * Phone OTP via Fast2SMS (SmsService).
 *
 * Store is IN-MEMORY (Map) — fine for a single backend instance; codes are
 * short-lived. NOTE: does not survive a restart and is not shared across
 * instances. Swap for Redis / a g4d_ table when scaling horizontally.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();

  constructor(private readonly sms: SmsService) {}

  private key(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
  }

  /** Generate + send a 6-digit code. Returns whether it went out for real or mock. */
  async request(phone: string): Promise<{ sent: boolean; mock: boolean; expiresInSec: number; devCode?: string }> {
    const key = this.key(phone);
    if (key.length !== 10) throw new BadRequestException('A valid 10-digit mobile number is required');

    const existing = this.store.get(key);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      throw new BadRequestException('Please wait a few seconds before requesting another code');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.store.set(key, { code, expiresAt: now + TTL_MS, attempts: 0, lastSentAt: now });

    const res = await this.sms.sendOtp(phone, code);
    if (res.mock) this.logger.log(`[MOCK] OTP for ${key} is ${code} (Fast2SMS not configured)`);
    // Opt-in DEV affordance: echo the code in the response ONLY when SMS is not
    // configured (mock) AND OTP_DEV_ECHO=true. Lets the owner test the funnel
    // before Fast2SMS is live. Off by default; never echoes once a key is set.
    const devCode = res.mock && process.env.OTP_DEV_ECHO === 'true' ? code : undefined;
    return { sent: true, mock: res.mock, expiresInSec: Math.floor(TTL_MS / 1000), devCode };
  }

  /** Verify a code. Consumes it on success. */
  verify(phone: string, code: string): boolean {
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
    return true;
  }
}
