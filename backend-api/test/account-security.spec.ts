import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { HttpException } from '@nestjs/common';
import { securityConfig } from '../src/account-security/account-security.config';
import { AccountSecurityController } from '../src/account-security/account-security.controller';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '../src/account-security/dto/password.dto';
import { LoginLimiter } from '../src/account-security/login-limiter';
import { hashToken, newToken } from '../src/account-security/token.util';

/** S13, no database: the pure rules (token handling, configuration, password policy, rate-limit metadata, login limiter). */

describe('token handling', () => {
  it('generates long, unique, url-safe tokens', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(newToken('rt_'));
    expect(seen.size).toBe(2000);
    const t = newToken('rt_');
    expect(t).toMatch(/^rt_[A-Za-z0-9_-]{43}$/);          // 32 random bytes = 256 bits
  });
  it('stores only a SHA-256 of the token: deterministic, 64 hex chars, never the token itself', () => {
    const t = newToken('');
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).not.toBe(hashToken(newToken('')));
  });
});

describe('configuration (read at call time, from the environment, with safe defaults)', () => {
  const KEYS = ['PASSWORD_RESET_TTL_MINUTES', 'PASSWORD_RESET_MAX_PER_HOUR', 'REFRESH_TOKEN_TTL_DAYS', 'ACCESS_TOKEN_TTL', 'AUTH_MIN_FAILURE_MS', 'LOGIN_MAX_FAILURES', 'LOGIN_FAILURE_WINDOW_MINUTES'];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('defaults: reset link 30 minutes, 3 reset mails per account per hour, refresh token 30 days, access token unchanged at 7 days', () => {
    expect(securityConfig()).toMatchObject({ resetTtlMinutes: 30, resetMaxPerHour: 3, refreshTtlDays: 30, accessTtl: '7d', loginMaxFailures: 10 });
  });
  it('every value can be set from the environment', () => {
    process.env.PASSWORD_RESET_TTL_MINUTES = '5'; process.env.PASSWORD_RESET_MAX_PER_HOUR = '2'; process.env.REFRESH_TOKEN_TTL_DAYS = '7';
    process.env.ACCESS_TOKEN_TTL = '15m'; process.env.LOGIN_MAX_FAILURES = '4';
    expect(securityConfig()).toMatchObject({ resetTtlMinutes: 5, resetMaxPerHour: 2, refreshTtlDays: 7, accessTtl: '15m', loginMaxFailures: 4 });
  });
  it('nonsense values fall back to the safe default', () => {
    process.env.PASSWORD_RESET_TTL_MINUTES = 'abc'; process.env.REFRESH_TOKEN_TTL_DAYS = '-3'; process.env.PASSWORD_RESET_MAX_PER_HOUR = '0';
    expect(securityConfig()).toMatchObject({ resetTtlMinutes: 30, refreshTtlDays: 30, resetMaxPerHour: 3 });
  });
});

describe('new-password policy (same rule as signup, plus the bcrypt 72-character limit)', () => {
  const errorsFor = async (password: string) => (await validate(plainToInstance(ResetPasswordDto, { token: 'x'.repeat(43), newPassword: password }))).flatMap((e) => Object.values(e.constraints ?? {}));
  it('accepts a strong password', async () => { expect(await errorsFor('StrongPass1')).toEqual([]); });
  it('rejects short, no uppercase, no digit, and over 72 characters', async () => {
    expect((await errorsFor('Short1')).length).toBeGreaterThan(0);
    expect((await errorsFor('alllowercase1')).length).toBeGreaterThan(0);
    expect((await errorsFor('NoDigitsHere')).length).toBeGreaterThan(0);
    expect((await errorsFor('A1' + 'x'.repeat(71))).length).toBeGreaterThan(0);
  });
  it('change-password applies the same rule to the new password and needs the current one', async () => {
    const bad = await validate(plainToInstance(ChangePasswordDto, { currentPassword: '', newPassword: 'weak' }));
    expect(bad.map((e) => e.property).sort()).toEqual(['currentPassword', 'newPassword']);
    expect(await validate(plainToInstance(ChangePasswordDto, { currentPassword: 'Old1pass', newPassword: 'NewPass123' }))).toEqual([]);
  });
  it('forgot-password needs a well-formed email', async () => {
    expect((await validate(plainToInstance(ForgotPasswordDto, { email: 'not-an-email' }))).length).toBe(1);
    expect(await validate(plainToInstance(ForgotPasswordDto, { email: 'a@b.com' }))).toEqual([]);
  });
});

describe('rate limits are declared on every credential route', () => {
  const proto = AccountSecurityController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const limitOf = (method: string): number | undefined => Reflect.getMetadata(`${THROTTLER_LIMIT}default`, proto[method]);
  it.each(['login', 'refresh', 'forgot', 'reset', 'change'])('%s has a per-IP throttle', (m) => {
    expect(typeof limitOf(m)).toBe('number');
  });
  it('forgot and reset are tighter than the global default', () => {
    expect(limitOf('forgot')).toBeLessThanOrEqual(5);
    expect(limitOf('reset')).toBeLessThanOrEqual(10);
  });
});

describe('login limiter (per IP + email, in memory)', () => {
  const key = '10.0.0.1|a@b.com';
  it('refuses after the configured number of failures and recovers after the window', () => {
    process.env.LOGIN_MAX_FAILURES = '3'; process.env.LOGIN_FAILURE_WINDOW_MINUTES = '15';
    let now = 1_000_000;
    const l = new LoginLimiter(() => now);
    for (let i = 0; i < 3; i++) { l.assertAllowed(key); l.recordFailure(key); }
    expect(() => l.assertAllowed(key)).toThrow(HttpException);
    try { l.assertAllowed(key); } catch (e) { expect((e as HttpException).getStatus()).toBe(429); }
    now += 16 * 60_000;
    expect(() => l.assertAllowed(key)).not.toThrow();
    delete process.env.LOGIN_MAX_FAILURES; delete process.env.LOGIN_FAILURE_WINDOW_MINUTES;
  });
  it('does not lock out a different email or IP (an attacker cannot lock the owner out from elsewhere)', () => {
    process.env.LOGIN_MAX_FAILURES = '2';
    const l = new LoginLimiter(() => 1);
    for (let i = 0; i < 2; i++) l.recordFailure(key);
    expect(() => l.assertAllowed('10.0.0.2|a@b.com')).not.toThrow();
    expect(() => l.assertAllowed('10.0.0.1|other@b.com')).not.toThrow();
    delete process.env.LOGIN_MAX_FAILURES;
  });
  it('a successful login clears the count', () => {
    process.env.LOGIN_MAX_FAILURES = '2';
    const l = new LoginLimiter(() => 1);
    l.recordFailure(key); l.recordSuccess(key); l.recordFailure(key);
    expect(() => l.assertAllowed(key)).not.toThrow();
    delete process.env.LOGIN_MAX_FAILURES;
  });
});
