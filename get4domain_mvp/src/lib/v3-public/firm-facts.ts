import { apiBase } from './config';
import { getJson } from './api';
import { getFirm } from './firm';
import { useMocks } from './flag';

/**
 * The facts about the firm that the legal, About and Contact pages may print. Two sources, nothing invented:
 *  1. The public firm route of the API (GET /v3/public/firm): legal name, registered address and the GSTIN only when one is set.
 *  2. One config module (this file, `readContactConfig`) for what that route does not carry: support email and phone, grievance officer, CIN.
 *     Every value is empty until the admin sets it in the server environment, and a page prints nothing for an empty value (never a placeholder).
 */
export interface FirmFacts {
  legalName: string;
  /** the registered address as one line */
  address: string;
  /** empty when not set */
  gstin: string;
  cin: string;
  supportEmail: string;
  supportPhone: string;
  grievanceName: string;
  grievanceEmail: string;
  grievancePhone: string;
}

export type ContactConfig = Pick<FirmFacts, 'cin' | 'supportEmail' | 'supportPhone' | 'grievanceName' | 'grievanceEmail' | 'grievancePhone'>;

type Env = Record<string, string | undefined>;

/** The brand and the decided location of the company, used only when the API cannot give the registered address. */
const FALLBACK_COUNTRY_PART = 'Tamil Nadu, India';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f<>]/g;
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,200}\.[^\s@<>"]{2,}$/;
const PHONE = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

const text = (v: string | undefined, max: number): string => (v ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const email = (v: string | undefined): string => { const t = text(v, 254); return EMAIL.test(t) ? t : ''; };
const phone = (v: string | undefined): string => { const t = text(v, 24); return PHONE.test(t) ? t : ''; };

/** Names only are documented in .env.local.example. A value that is not valid (an email without an @, a phone with letters) counts as empty. */
export function readContactConfig(env: Env = process.env): ContactConfig {
  return {
    cin: text(env.V3_PUBLIC_FIRM_CIN, 40),
    supportEmail: email(env.V3_PUBLIC_SUPPORT_EMAIL),
    supportPhone: phone(env.V3_PUBLIC_SUPPORT_PHONE),
    grievanceName: text(env.V3_PUBLIC_GRIEVANCE_OFFICER_NAME, 120),
    grievanceEmail: email(env.V3_PUBLIC_GRIEVANCE_OFFICER_EMAIL),
    grievancePhone: phone(env.V3_PUBLIC_GRIEVANCE_OFFICER_PHONE),
  };
}

/** The sample firm used in mock mode and when the API cannot answer: the facts the company has decided, no more. */
export function fallbackFirm(config: ContactConfig = readContactConfig()): FirmFacts {
  const f = getFirm();
  return { legalName: f.name, address: `${f.address}, ${FALLBACK_COUNTRY_PART}`, gstin: (f.gstin ?? '').trim(), ...config };
}

interface PublicFirm { legalName?: unknown; registeredAddress?: unknown; gstin?: unknown }

/** Maps the answer of GET /v3/public/firm onto the facts. A field that is missing or not text keeps the fallback value; the GSTIN is taken only when it is text. */
export function mergeFirm(api: PublicFirm | null | undefined, config: ContactConfig = readContactConfig()): FirmFacts {
  const base = fallbackFirm(config);
  if (!api || typeof api !== 'object') return base;
  const s = (v: unknown, max: number): string => (typeof v === 'string' ? text(v, max) : '');
  return {
    ...base,
    legalName: s(api.legalName, 120) || base.legalName,
    address: s(api.registeredAddress, 400) || base.address,
    gstin: s(api.gstin, 15),
  };
}

/** Server side. Mock mode (the default) never touches the network. Real mode asks the API and falls back to the decided facts when it cannot answer. */
export async function getFirmFacts(): Promise<FirmFacts> {
  const config = readContactConfig();
  if (useMocks()) return fallbackFirm(config);
  const base = apiBase();
  if (!base) return fallbackFirm(config);
  const r = await getJson<PublicFirm>(`${base}/v3/public/firm`, 300);
  return r.kind === 'ok' ? mergeFirm(r.data, config) : fallbackFirm(config);
}

export interface FactRow { key: string; label: string; value: string; href?: string }

/** The rows a page prints. A row whose value is empty is not returned, so nothing is printed for it. */
export function firmRows(f: FirmFacts, labels: { name: string; address: string; gstin: string; cin: string; supportEmail: string; supportPhone: string }): FactRow[] {
  const rows: FactRow[] = [
    { key: 'name', label: labels.name, value: f.legalName },
    { key: 'address', label: labels.address, value: f.address },
    { key: 'gstin', label: labels.gstin, value: f.gstin },
    { key: 'cin', label: labels.cin, value: f.cin },
    { key: 'supportEmail', label: labels.supportEmail, value: f.supportEmail, href: f.supportEmail ? `mailto:${f.supportEmail}` : undefined },
    { key: 'supportPhone', label: labels.supportPhone, value: f.supportPhone, href: f.supportPhone ? `tel:${f.supportPhone.replace(/[^0-9+]/g, '')}` : undefined },
  ];
  return rows.filter((r) => r.value.trim() !== '');
}

/** True when any grievance contact value is set (the Contact page prints the section only then). */
export function hasGrievanceContact(f: FirmFacts): boolean {
  return !!(f.grievanceName || f.grievanceEmail || f.grievancePhone);
}

/** The grievance officer rows a page prints: a row whose value is empty is not returned. */
export function grievanceRows(f: FirmFacts, labels: { name: string; email: string; phone: string }): FactRow[] {
  const rows: FactRow[] = [
    { key: 'name', label: labels.name, value: f.grievanceName },
    { key: 'email', label: labels.email, value: f.grievanceEmail, href: f.grievanceEmail ? `mailto:${f.grievanceEmail}` : undefined },
    { key: 'phone', label: labels.phone, value: f.grievancePhone, href: f.grievancePhone ? `tel:${f.grievancePhone.replace(/[^0-9+]/g, '')}` : undefined },
  ];
  return rows.filter((r) => r.value.trim() !== '');
}
