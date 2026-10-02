import { ExecutionContext, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/**
 * Rate limiting (security patch 2026-10-02). Per client IP, per route, in memory (single API
 * instance; move the storage to Redis if the API is ever scaled horizontally).
 *
 * - A sane GLOBAL default protects every route: 300 writes/min (POST/PUT/PATCH/DELETE) and a far more
 *   generous 1500 reads/min (GET/HEAD/OPTIONS) — the Next.js server renders vendor sites by calling this
 *   API from ONE IP, so reads must not be throttled like credential endpoints.
 * - Sensitive routes carry tighter `@Throttle(RATE.x)` limits (login, OTP, payments, webhooks…).
 * - The client IP is Express `req.ip`; main.ts sets `trust proxy` so that behind nginx it is the address
 *   nginx saw (not forgeable via X-Forwarded-For). Set TRUST_PROXY_HOPS to the number of proxies.
 * - Tuning without a code change: THROTTLE_GLOBAL_LIMIT, THROTTLE_READ_LIMIT (per minute),
 *   THROTTLE_TRUSTED_IPS (comma-separated IPs never limited — e.g. the web server), and the emergency
 *   switch THROTTLE_DISABLED=true.
 */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const httpMethod = (ctx: ExecutionContext): string => String(ctx.switchToHttp().getRequest<{ method?: string }>().method ?? '').toUpperCase();
const clientIp = (ctx: ExecutionContext): string | undefined => ctx.switchToHttp().getRequest<{ ip?: string }>().ip;
const intFromEnv = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const GLOBAL_LIMIT = { limit: intFromEnv('THROTTLE_GLOBAL_LIMIT', 300), ttl: 60_000 } as const;
export const READ_LIMIT = { limit: intFromEnv('THROTTLE_READ_LIMIT', 1500), ttl: 60_000 } as const;

export const RATE = {
  /** Credential endpoints — brute-force / credential-stuffing targets. */
  login: { default: { limit: 10, ttl: 60_000 } },
  register: { default: { limit: 5, ttl: 60_000 } },
  /** Also called server-side by the Next.js demo route (one shared IP), so deliberately roomy. */
  refresh: { default: { limit: 120, ttl: 60_000 } },
  /** OTP — SMS cost + code guessing. */
  otpRequest: { default: { limit: 3, ttl: 60_000 } },
  otpVerify: { default: { limit: 10, ttl: 60_000 } },
  /** Money movement — order creation / payment confirmation. */
  payment: { default: { limit: 20, ttl: 60_000 } },
  /** Public storefront actions (enquiry / checkout order / confirm). */
  publicAction: { default: { limit: 30, ttl: 60_000 } },
  /** Provider webhooks: generous (providers retry), but not unlimited. */
  webhook: { default: { limit: 120, ttl: 60_000 } },
  whatsappWebhook: { default: { limit: 300, ttl: 60_000 } },
} as const;

/** True for traffic that is never rate limited (emergency switch, or an explicitly trusted caller IP). */
const exempt = (ctx: ExecutionContext): boolean => {
  if (process.env.THROTTLE_DISABLED === 'true') return true;
  const trusted = (process.env.THROTTLE_TRUSTED_IPS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const ip = clientIp(ctx);
  return trusted.length > 0 && ip !== undefined && trusted.includes(ip);
};

// NOTE: a throttler's own skipIf replaces the module-level one, so the exemptions are applied in each.
export const throttlerImport = ThrottlerModule.forRoot({
  throttlers: [
    { name: 'default', ttl: GLOBAL_LIMIT.ttl, limit: GLOBAL_LIMIT.limit, skipIf: (ctx) => exempt(ctx) || READ_METHODS.has(httpMethod(ctx)) },
    { name: 'reads', ttl: READ_LIMIT.ttl, limit: READ_LIMIT.limit, skipIf: (ctx) => exempt(ctx) || !READ_METHODS.has(httpMethod(ctx)) },
  ],
  skipIf: exempt,
});

/** Must be listed BEFORE the JWT guard so unauthenticated floods are rejected with 429 first. */
export const throttlerGuardProvider: Provider = { provide: APP_GUARD, useClass: ThrottlerGuard };
