import { GatewayName } from './gateway-core';

/**
 * The pure rules of the gateway credentials the SUPER_ADMIN enters in the admin app (Wave 4 W6). No database, no environment. Credentials are WRITE-ONLY: nothing here, and nothing built from it, ever returns a
 * value back, and no message names one. Each gateway and mode (test or live) has its own set; a set is replaced as a whole.
 */
export type CredentialMode = 'test' | 'live';
export const CREDENTIAL_MODES: readonly CredentialMode[] = ['test', 'live'];
export const isCredentialMode = (v: unknown): v is CredentialMode => v === 'test' || v === 'live';

export interface FieldSpec { field: string; /** the identifier part that is not secret: only this field may show its last 4 characters */ identifier: boolean }
export const CREDENTIAL_FIELDS: Readonly<Record<GatewayName, readonly FieldSpec[]>> = {
  razorpay: [{ field: 'keyId', identifier: true }, { field: 'keySecret', identifier: false }, { field: 'webhookSecret', identifier: false }],
  cashfree: [{ field: 'appId', identifier: true }, { field: 'secretKey', identifier: false }],
};
export const fieldNames = (g: GatewayName): string[] => CREDENTIAL_FIELDS[g].map((f) => f.field);
export const identifierField = (g: GatewayName): string => CREDENTIAL_FIELDS[g].find((f) => f.identifier)!.field;

export type CredentialValues = Record<string, string>;
export type CredentialCheck = { ok: true; values: CredentialValues } | { ok: false; fields: Record<string, string> };

// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\s\u0000-\u001f\u007f]/;

/**
 * Checks a full set for one gateway and mode. Every field is required. A value is 6 to 200 characters with no space or control character (a pasted key often carries a stray space or line break: it is refused, not
 * silently trimmed away from the middle). A Razorpay key id must carry the prefix of the mode (rzp_test_ or rzp_live_), so a live key cannot be saved as a test key by mistake. The messages name the FIELD only.
 */
export function checkCredentials(gateway: GatewayName, mode: CredentialMode, input: unknown): CredentialCheck {
  const fields: Record<string, string> = {};
  const values: CredentialValues = {};
  const body = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  for (const { field } of CREDENTIAL_FIELDS[gateway]) {
    const raw = body[field];
    const v = typeof raw === 'string' ? raw.trim() : null;
    if (v === null || v === '') { fields[field] = 'required'; continue; }
    if (v.length < 6 || v.length > 200) { fields[field] = 'must be 6 to 200 characters'; continue; }
    if (BAD_CHARS.test(v)) { fields[field] = 'must not contain spaces or line breaks'; continue; }
    values[field] = v;
  }
  for (const k of Object.keys(body)) if (!fieldNames(gateway).includes(k)) fields[k] = 'not a field of this gateway';
  if (gateway === 'razorpay' && values.keyId && !values.keyId.startsWith(`rzp_${mode}_`)) fields.keyId = `a ${mode} key id starts with rzp_${mode}_`;
  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, values };
}

/** At most the last 4 characters of an identifier (a key id or an app id), and only when it is long enough that 4 characters reveal little; otherwise nothing. */
export function lastFour(identifier: string | null | undefined): string | null {
  return typeof identifier === 'string' && identifier.length >= 12 ? identifier.slice(-4) : null;
}

/** The storage key of one value: category-wide, one row per gateway, mode and field. */
export const CREDENTIAL_CATEGORY = 'v3_gateway_credentials';
export const credentialKey = (gateway: GatewayName, mode: CredentialMode, field: string): string => `${gateway}.${mode}.${field}`;
