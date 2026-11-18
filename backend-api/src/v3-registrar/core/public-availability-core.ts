import { parseDomain } from './registrar-core';

/**
 * B3.6 the public domain availability answer. PURE. One typed name, two honest answers:
 *   - the free subdomain: AVAILABLE, TAKEN (taken or not allowed: one answer, so the check is not an oracle), RESERVED or INVALID, with the similar-name warning;
 *   - a custom domain: REGISTRAR_OFF while the registrar is switched off (nothing is asked of it), then AVAILABLE or TAKEN per extension when it is on,
 *     UNKNOWN when the registrar did not answer, NOT_FOR_SALE when no extension has a price yet or the typed extension is not sold.
 * "Available" is only ever said for a name the registrar itself answered AVAILABLE for. It is never a default, never a guess and never a fallback.
 */
export type SubdomainState = 'AVAILABLE' | 'TAKEN' | 'RESERVED' | 'INVALID';
export type CustomDomainState = 'REGISTRAR_OFF' | 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' | 'NOT_FOR_SALE' | 'INVALID';

export interface SubdomainInput { available: boolean; name: string | null; reason: 'AVAILABLE' | 'INVALID' | 'RESERVED' | 'UNAVAILABLE'; message: string; similarTo?: string | null }
export interface RegistrarHit { domain: string; status: 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' }

export interface DomainAvailability {
  /** the typed text as understood: lower case, no spaces; null when nothing usable was typed */
  name: string | null;
  subdomain: { state: SubdomainState; name: string | null; message: string; similarTo: string | null } | null;
  customDomain: {
    state: CustomDomainState; registrar: 'ON' | 'OFF'; message: string;
    /** one row per extension asked about, only when the registrar answered */
    results: Array<{ domain: string; state: 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' }>;
  };
}

export const CUSTOM_MESSAGES: Readonly<Record<CustomDomainState, string>> = Object.freeze({
  REGISTRAR_OFF: 'Registering new domain names is not switched on yet. You can connect a domain you already own.',
  AVAILABLE: 'This name is available to register.',
  TAKEN: 'This name is already taken.',
  UNKNOWN: 'We could not check this name just now. Please try again.',
  NOT_FOR_SALE: 'We do not sell this kind of domain yet.',
  INVALID: 'Use letters, digits and hyphens, for example yourbusiness or yourbusiness.in.',
});

/** What was typed, split: the label before the first dot, the full domain when an extension was typed. */
export function readTyped(input: unknown): { label: string | null; full: string | null; tld: string | null } {
  const raw = String(input ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/\s+/g, '').slice(0, 253);
  if (!raw) return { label: null, full: null, tld: null };
  if (!raw.includes('.')) return { label: raw, full: null, tld: null };
  const p = parseDomain(raw);
  if (p.ok) return { label: p.sld, full: p.domain, tld: p.tld };
  return { label: raw.slice(0, raw.indexOf('.')) || null, full: null, tld: null };
}
export const validLabel = (s: string | null): s is string => !!s && /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(s);

const STATE_OF: Record<SubdomainInput['reason'], SubdomainState> = { AVAILABLE: 'AVAILABLE', INVALID: 'INVALID', RESERVED: 'RESERVED', UNAVAILABLE: 'TAKEN' };

export function shapeAvailability(i: {
  typed: ReturnType<typeof readTyped>; subdomain: SubdomainInput | null;
  registrarOn: boolean; tldsOnSale: readonly string[]; hits: readonly RegistrarHit[] | null; registrarFailed: boolean;
}): DomainAvailability {
  const registrar: 'ON' | 'OFF' = i.registrarOn ? 'ON' : 'OFF';
  const sub = i.subdomain ? { state: STATE_OF[i.subdomain.reason], name: i.subdomain.available ? i.subdomain.name : null, message: i.subdomain.message, similarTo: i.subdomain.similarTo ?? null } : null;
  const custom = (state: CustomDomainState, results: DomainAvailability['customDomain']['results'] = []): DomainAvailability['customDomain'] => ({ state, registrar, message: CUSTOM_MESSAGES[state], results });
  const name = i.typed.full ?? i.typed.label;
  if (!validLabel(i.typed.label)) return { name, subdomain: sub, customDomain: custom(i.typed.label ? 'INVALID' : 'INVALID') };
  if (!i.registrarOn) return { name, subdomain: sub, customDomain: custom('REGISTRAR_OFF') };
  if (i.tldsOnSale.length === 0 || (i.typed.tld !== null && !i.tldsOnSale.includes(i.typed.tld))) return { name, subdomain: sub, customDomain: custom('NOT_FOR_SALE') };
  if (i.registrarFailed || i.hits === null) return { name, subdomain: sub, customDomain: custom('UNKNOWN') };
  const asked = i.typed.full ? i.hits.filter((h) => h.domain.toLowerCase() === i.typed.full) : i.hits;
  const results = asked.map((h) => ({ domain: h.domain.toLowerCase(), state: h.status }));
  if (results.length === 0) return { name, subdomain: sub, customDomain: custom('UNKNOWN') };
  // the overall word: AVAILABLE only when the typed full name (or at least one extension of the typed label) is truly available; UNKNOWN beats TAKEN when nothing is available but something is unsure
  const state: CustomDomainState = results.some((r) => r.state === 'AVAILABLE') ? 'AVAILABLE' : results.some((r) => r.state === 'UNKNOWN') ? 'UNKNOWN' : 'TAKEN';
  return { name, subdomain: sub, customDomain: custom(state, results) };
}
