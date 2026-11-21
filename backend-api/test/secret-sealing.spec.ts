import { sealOrFail } from '../src/requests-orders/vendor-requests.service';
import { openSecret } from '../src/ai-studio/secret-box';

/** Credentials of a vendor's payment method are sealed with PLATFORM_SETTINGS_KEY: either 64 hex characters (used as the AES-256 key) or any passphrase (hashed to a key). */
describe('sealing a vendor credential', () => {
  const saved = process.env.PLATFORM_SETTINGS_KEY;
  afterEach(() => { if (saved === undefined) delete process.env.PLATFORM_SETTINGS_KEY; else process.env.PLATFORM_SETTINGS_KEY = saved; });

  it.each([['64 hex characters', 'a'.repeat(32) + '0123456789abcdef0123456789abcdef'], ['a passphrase', 'a long test passphrase for staging only']])('with %s: seals, never keeps the plain text, shows only the last four, opens again', (_n, key) => {
    process.env.PLATFORM_SETTINGS_KEY = key;
    const s = sealOrFail('rzp_vendor_key_1234');
    expect(s.last4).toBe('1234');
    expect(JSON.stringify(s)).not.toContain('rzp_vendor_key');
    expect(s.cipher).toBeTruthy(); expect(s.iv).toBeTruthy(); expect(s.tag).toBeTruthy();
    expect(openSecret(s)).toBe('rzp_vendor_key_1234');
  });

  it('without the key: a clear 503 with a stable code, and nothing sealed (no plain-text fallback)', () => {
    delete process.env.PLATFORM_SETTINGS_KEY;
    let thrown: { getStatus?: () => number; getResponse?: () => Record<string, unknown> } | undefined;
    try { sealOrFail('rzp_vendor_key_1234'); } catch (e) { thrown = e as typeof thrown; }
    expect(thrown?.getStatus?.()).toBe(503);
    expect(thrown?.getResponse?.()).toMatchObject({ code: 'SECRET_STORE_UNAVAILABLE' });
    expect(JSON.stringify(thrown?.getResponse?.())).not.toContain('rzp_vendor_key');
  });

  it('a wrong key cannot open a sealed secret', () => {
    process.env.PLATFORM_SETTINGS_KEY = 'first passphrase for the test';
    const s = sealOrFail('rzp_vendor_key_1234');
    process.env.PLATFORM_SETTINGS_KEY = 'second passphrase for the test';
    expect(openSecret(s)).toBeNull();
  });
});
