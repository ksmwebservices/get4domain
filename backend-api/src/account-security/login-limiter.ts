import { HttpException, HttpStatus } from '@nestjs/common';
import { securityConfig } from './account-security.config';

/**
 * Failed-login limiter, keyed on IP + email. In memory (one backend process): a restart or a second instance resets it, which is why the
 * per-IP @Throttle on the route stays as the outer limit. Keying on the pair means an attacker cannot lock the real owner out from another IP.
 */
export class LoginLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  private recent(key: string): number[] {
    const cutoff = this.now() - securityConfig().loginWindowMinutes * 60_000;
    const kept = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length) this.failures.set(key, kept); else this.failures.delete(key);
    return kept;
  }

  /** Throws 429 when this IP + email has used up its failures for the window. Says nothing about whether the account exists. */
  assertAllowed(key: string): void {
    if (this.recent(key).length >= securityConfig().loginMaxFailures) {
      throw new HttpException('Too many sign-in attempts. Please wait a few minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  recordFailure(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.failures.set(key, list);
    if (this.failures.size > 10_000) this.failures.delete(this.failures.keys().next().value as string);   // bound memory
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }
}
