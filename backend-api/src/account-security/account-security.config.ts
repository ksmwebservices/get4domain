/**
 * Account-security settings, read from the environment at CALL time (so a test, or an operator restarting with a new value, changes them
 * without a rebuild). A missing, non-numeric or non-positive value falls back to the safe default.
 */
const positive = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export interface SecurityConfig {
  /** How long a password-reset link works. */
  resetTtlMinutes: number;
  /** Reset mails sent per account per hour; extra requests are answered the same way but send nothing. */
  resetMaxPerHour: number;
  /** How long a refresh token (and so a "remember me" session) lasts without being used. */
  refreshTtlDays: number;
  /** Access-token lifetime issued by the session routes. Stays at the legacy 7d until the frontend uses refresh tokens; then set e.g. 15m. */
  accessTtl: string;
  /** Failed logins take at least this long, so an unknown email cannot be told apart by speed. */
  minFailureMs: number;
  loginMaxFailures: number;
  loginWindowMinutes: number;
  frontendUrl: string;
}

export function securityConfig(): SecurityConfig {
  return {
    resetTtlMinutes: positive('PASSWORD_RESET_TTL_MINUTES', 30),
    resetMaxPerHour: positive('PASSWORD_RESET_MAX_PER_HOUR', 3),
    refreshTtlDays: positive('REFRESH_TOKEN_TTL_DAYS', 30),
    accessTtl: process.env.ACCESS_TOKEN_TTL?.trim() || '7d',
    minFailureMs: positive('AUTH_MIN_FAILURE_MS', 300),
    loginMaxFailures: positive('LOGIN_MAX_FAILURES', 10),
    loginWindowMinutes: positive('LOGIN_FAILURE_WINDOW_MINUTES', 15),
    frontendUrl: (process.env.FRONTEND_URL ?? 'https://get4domain.com').replace(/\/+$/, ''),
  };
}
