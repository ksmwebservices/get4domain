import { useMocks } from './flag';
import { callApi } from './proxy';

/**
 * The answer of GET /v3/public/domain-availability for one typed name, as the box shows it. Two honest answers:
 *  - the free subdomain: AVAILABLE, TAKEN, RESERVED or INVALID, with the similar-name warning (`similarTo`);
 *  - a custom domain: REGISTRAR_OFF while the registrar is switched off, AVAILABLE or TAKEN per extension when it is on, UNKNOWN when it did not answer, NOT_FOR_SALE, INVALID.
 * "Available" is shown only when the API says AVAILABLE. A missing, malformed or failed answer is `ok: false`, never available.
 */
export type SubState = 'AVAILABLE' | 'TAKEN' | 'RESERVED' | 'INVALID';
export type CustomState = 'REGISTRAR_OFF' | 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' | 'NOT_FOR_SALE' | 'INVALID';
export interface DomainAnswer {
  /** false when the API could not be reached or answered something unreadable */
  ok: boolean;
  name: string | null;
  subdomain: { state: SubState; name: string | null; similarTo: string | null } | null;
  custom: { state: CustomState; registrarOn: boolean; results: Array<{ domain: string; state: 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' }> } | null;
}

const SUB: readonly string[] = ['AVAILABLE', 'TAKEN', 'RESERVED', 'INVALID'];
const CUSTOM: readonly string[] = ['REGISTRAR_OFF', 'AVAILABLE', 'TAKEN', 'UNKNOWN', 'NOT_FOR_SALE', 'INVALID'];
const RES: readonly string[] = ['AVAILABLE', 'TAKEN', 'UNKNOWN'];
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const NONE: DomainAnswer = { ok: false, name: null, subdomain: null, custom: null };

/** The raw API answer (plain or inside { data }) to the box model. Any state outside the contract's list is dropped to null, so it can never read as available. */
export function fromDomainAvailability(json: unknown): DomainAnswer {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const o = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const sub = o.subdomain && typeof o.subdomain === 'object' ? (o.subdomain as Record<string, unknown>) : null;
  const cd = o.customDomain && typeof o.customDomain === 'object' ? (o.customDomain as Record<string, unknown>) : null;
  const subState = sub && typeof sub.state === 'string' && SUB.includes(sub.state) ? (sub.state as SubState) : null;
  const cdState = cd && typeof cd.state === 'string' && CUSTOM.includes(cd.state) ? (cd.state as CustomState) : null;
  if (!subState && !cdState) return NONE;
  return {
    ok: true,
    name: str(o.name, 253),
    // a subdomain name is kept only for AVAILABLE, as the API sends it
    subdomain: subState ? { state: subState, name: subState === 'AVAILABLE' ? str(sub?.name, 63) : null, similarTo: str(sub?.similarTo, 63) } : null,
    custom: cdState ? {
      state: cdState,
      registrarOn: cd?.registrar === 'ON',
      results: (Array.isArray(cd?.results) ? (cd?.results as unknown[]) : [])
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map((r) => ({ domain: str(r.domain, 253) ?? '', state: (typeof r.state === 'string' && RES.includes(r.state) ? r.state : 'UNKNOWN') as 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' }))
        .filter((r) => r.domain),
    } : null,
  };
}

/** Sample mode: these labels are taken. The registrar is off in the sample, as it is until it is switched on. */
export const MOCK_DOMAIN_TAKEN: readonly string[] = ['sample-pro', 'sample-free', 'taken-site'];
export function mockDomainAnswer(typed: string): DomainAnswer {
  const t = typed.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
  const label = t.split('.')[0] ?? '';
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return { ok: true, name: t || null, subdomain: { state: 'INVALID', name: null, similarTo: null }, custom: { state: 'INVALID', registrarOn: false, results: [] } };
  const taken = MOCK_DOMAIN_TAKEN.includes(label);
  return {
    ok: true, name: t,
    subdomain: { state: taken ? 'TAKEN' : 'AVAILABLE', name: taken ? null : label, similarTo: !taken && label.replace(/-/g, '') === 'samplepro' ? 'sample-pro' : null },
    custom: { state: 'REGISTRAR_OFF', registrarOn: false, results: [] },
  };
}

/** One typed name to the answer. Nothing typed is no call. The API being unreachable is `ok: false`. */
export async function handleDomainAvailability(req: Request, typed: string): Promise<DomainAnswer> {
  const name = typed.trim().slice(0, 253);
  if (!name) return NONE;
  if (useMocks()) return mockDomainAnswer(name);
  const r = await callApi(req, `/v3/public/domain-availability?name=${encodeURIComponent(name)}`, { method: 'GET' });
  if (!r || !r.ok) return NONE;
  return fromDomainAvailability(r.json);
}
