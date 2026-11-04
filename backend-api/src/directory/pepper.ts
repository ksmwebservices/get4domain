import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

/**
 * The key for the OTP, phone and IP hashes (slice 5.7). It is read from the environment at run time and never logged or returned. OTP_HASH_PEPPER wins; JWT_SECRET is the
 * fallback so no new secret is needed to start; outside production a fixed development value keeps unit tests working. Production without either refuses to hash.
 */
@Injectable()
export class OtpPepper {
  /** overridable in tests */
  env: Record<string, string | undefined> = process.env;
  value(): string {
    const v = this.env.OTP_HASH_PEPPER || this.env.JWT_SECRET;
    if (v) return v;
    if (this.env.NODE_ENV === 'production') throw new Error('OTP_HASH_PEPPER or JWT_SECRET must be set');
    return 'development-only-pepper';
  }
  hashIp(ip: string | null | undefined): string | null { return ip ? createHmac('sha256', this.value()).update(`ip:${ip}`).digest('hex') : null; }
}
