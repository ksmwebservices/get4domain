/**
 * R1.1 the pure rules of the platform integration settings the SUPER_ADMIN enters in the admin app. No database, no environment, no network.
 * WRITE-ONLY for secrets: nothing here, and nothing built from it, returns a secret or a length of one. A field is either a SECRET (never shown), or a PLAIN setting (a mode, a sender, a cap, a reseller id)
 * that the status may show. Each provider's set is replaced as a whole.
 */
export const INTEGRATION_CATEGORY = 'v3_integrations';   // its own category: the older platform settings screen has a fixed list of categories and cannot list or write this one

export type ProviderKey = 'resellerclub' | 'email' | 'whatsapp' | 'sms' | 'claude';
export const PROVIDER_KEYS: readonly ProviderKey[] = ['resellerclub', 'email', 'whatsapp', 'sms', 'claude'];
export const isProviderKey = (v: unknown): v is ProviderKey => typeof v === 'string' && (PROVIDER_KEYS as readonly string[]).includes(v);

export interface FieldSpec { field: string; secret: boolean; label: string; /** the one plain field the status may show the last 4 characters of (the reseller id) */ hint?: boolean }
export interface ProviderSpec { key: ProviderKey; name: string; /** false = status only: nothing can be stored */ available: boolean; fields: readonly FieldSpec[]; note: string }

export const PROVIDERS: Readonly<Record<ProviderKey, ProviderSpec>> = {
  resellerclub: {
    key: 'resellerclub', name: 'ResellerClub (domains)', available: true, note: 'Mode demo uses test.httpapi.com with demo credentials; mode live uses httpapi.com. ResellerClub only answers from whitelisted server addresses.',
    fields: [{ field: 'resellerId', secret: false, label: 'Reseller id (auth-userid)', hint: true }, { field: 'apiKey', secret: true, label: 'API key' }, { field: 'mode', secret: false, label: 'Mode (demo or live)' }],
  },
  email: {
    key: 'email', name: 'E-mail (Resend)', available: true, note: 'The sender must belong to a domain verified in Resend. Nothing is sent by saving or testing.',
    fields: [{ field: 'apiKey', secret: true, label: 'Resend API key' }, { field: 'sender', secret: false, label: 'Sender (for example "Get4Domain <hello@yourdomain.com>")' }],
  },
  whatsapp: { key: 'whatsapp', name: 'WhatsApp', available: false, fields: [], note: 'Not available yet.' },
  sms: { key: 'sms', name: 'SMS', available: false, fields: [], note: 'Not available yet.' },
  claude: {
    key: 'claude', name: 'Claude API (chat assistant)', available: true, note: 'A setting for the later chat assistant. Nothing uses it yet. The cap is in whole rupees per calendar month.',
    fields: [{ field: 'apiKey', secret: true, label: 'Claude API key' }, { field: 'monthlyCapRupees', secret: false, label: 'Monthly cap in rupees' }],
  },
};

export const fieldsOf = (p: ProviderKey): readonly FieldSpec[] => PROVIDERS[p].fields;
export const settingKey = (p: ProviderKey, field: string): string => `${p}.${field}`;

export type Values = Record<string, string>;
export type Check = { ok: true; values: Values } | { ok: false; fields: Record<string, string> };

// eslint-disable-next-line no-control-regex
const BAD = /[\s\u0000-\u001f\u007f]/;
const SENDER = /^(?:[^<>@\r\n]{1,80} )?<?[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,}>?$/;

/**
 * Checks a full set. Every field is required. A secret is 8 to 300 characters with no space or control character (a pasted key often carries a stray space or line break; it is refused, not guessed).
 * The messages name the FIELD and the rule, never the value. A Resend key must start with `re_`.
 */
export function checkSet(provider: ProviderKey, input: unknown): Check {
  const spec = PROVIDERS[provider];
  if (!spec.available) return { ok: false, fields: { provider: 'not available' } };
  const body = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const fields: Record<string, string> = {}; const values: Values = {};
  for (const f of spec.fields) {
    const raw = body[f.field];
    const v = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : null;
    if (v === null || v === '') { fields[f.field] = 'required'; continue; }
    if (f.secret) {
      if (v.length < 8 || v.length > 300) { fields[f.field] = 'must be 8 to 300 characters'; continue; }
      if (BAD.test(v)) { fields[f.field] = 'must not contain spaces or line breaks'; continue; }
    }
    values[f.field] = v;
  }
  const bad = (f: string, why: string): void => { if (!fields[f]) fields[f] = why; };
  if (provider === 'resellerclub') {
    if (values.resellerId && !/^\d{3,12}$/.test(values.resellerId)) bad('resellerId', 'must be the numeric reseller id');
    if (values.mode && values.mode !== 'demo' && values.mode !== 'live') bad('mode', 'must be demo or live');
  }
  if (provider === 'email') {
    if (values.apiKey && !values.apiKey.startsWith('re_')) bad('apiKey', 'must be a Resend key (it starts with re_)');
    if (values.sender && !SENDER.test(values.sender)) bad('sender', 'must be an address or "Name <address>"');
  }
  if (provider === 'claude') {
    if (values.monthlyCapRupees && !/^\d{1,8}$/.test(values.monthlyCapRupees)) bad('monthlyCapRupees', 'must be a whole number of rupees (0 to 99999999)');
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, values };
}

export const lastFour = (v: string): string | null => (v.length >= 8 ? v.slice(-4) : null);

/** What the status may say about one provider. Secrets are only ever 'set' (or not) with the date; plain fields may be shown. */
export interface ProviderStatus {
  provider: ProviderKey; name: string; available: boolean; note: string;
  state: 'SET' | 'NOT_SET' | 'NOT_AVAILABLE';
  setBy: string | null; setAt: Date | null;
  fields: Array<{ field: string; label: string; secret: boolean; state: 'set' | 'not set'; /** plain fields only */ value?: string; /** the reseller id only: its last 4 characters */ hint?: string }>;
}

export type TestState = 'OK' | 'NOT_CONFIGURED' | 'NOT_AVAILABLE' | 'ACCESS_DENIED' | 'REJECTED' | 'TIMEOUT' | 'UNREACHABLE' | 'REGISTRAR_OFF' | 'UNKNOWN';
export interface TestResult { provider: ProviderKey; state: TestState; message: string; testedAt: Date }
/** Plain words for every state. None can hold a key, an address of ours or the provider's own text. */
export const TEST_MESSAGES: Readonly<Record<TestState, string>> = Object.freeze({
  OK: 'The provider accepted the saved details.',
  NOT_CONFIGURED: 'No details are saved for this provider yet.',
  NOT_AVAILABLE: 'This provider is not available yet.',
  ACCESS_DENIED: 'The provider refused the request. For ResellerClub this usually means this server\'s IP address is not whitelisted yet.',
  REJECTED: 'The provider did not accept the saved key. Check it and save it again.',
  TIMEOUT: 'The provider did not answer in time. Try again.',
  UNREACHABLE: 'The provider could not be reached. Try again.',
  REGISTRAR_OFF: 'Domain search is switched off on this server, so no call was made.',
  UNKNOWN: 'The provider gave an answer that could not be understood.',
});

/** The registered machine codes of the integration settings (registered with the exception filter through BUSINESS_ERROR_CODES). A screen switches on `code`, never on the sentence. */
export const INTEGRATION_ERROR_CODES = ['INTEGRATION_UNKNOWN', 'INTEGRATION_INVALID', 'INTEGRATION_NOT_AVAILABLE', 'INTEGRATION_UNAVAILABLE'] as const;
