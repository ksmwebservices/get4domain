import { useMocks } from './flag';
import { accessTokenOf, requestHandoff } from './handoff-api';
import { callApi } from './proxy';
import { readReferral } from './referral';
import { cleanSubdomain, mapRegisterFailure, PLAN_KEYS, subdomainProblem, subdomainStateOf, TERMS, validateRegister, type FieldErrors, type RegisterErrorKey, type RegisterInput, type SubdomainState } from './register';

/**
 * The registration calls of the browser, answered by the server (the browser talks only to this site; no token reaches it).
 * Mock mode answers from samples and never touches the network. In real mode the register route is POST /auth/register (Wave 3 adds `subdomain` and `referralCode`; nothing else is sent beyond the fields it already took)
 * and the address check is GET /v3/public/subdomain-availability?name= (Wave 3). The referral code is taken from the cookie on the server, never from the page.
 */
export interface RegisterResult { ok: boolean; fields: FieldErrors; general: RegisterErrorKey | null; handoff: string | null }

/** Sample mode: addresses that are taken. */
export const MOCK_TAKEN_SUBDOMAINS: readonly string[] = ['sample-pro', 'sample-free', 'taken-site'];
export const MOCK_TAKEN_EMAIL_REGISTER = 'taken@example.invalid';
export const MOCK_REGISTER_HANDOFF = 'mock-handoff-code-0000';

const str = (v: unknown, max: number): string => (typeof v === 'string' && v.length <= max ? v : '');
const fail = (fields: FieldErrors, general: RegisterErrorKey | null = null): RegisterResult => ({ ok: false, fields, general, handoff: null });

/** The form body to a typed input, or null when it is not even the right shape. */
export function parseRegisterBody(body: Record<string, unknown>): RegisterInput {
  const term = Number(body.termMonths);
  return {
    businessName: str(body.businessName, 120).trim(), categoryKey: str(body.categoryKey, 80), industry: str(body.industry, 80), subdomain: cleanSubdomain(str(body.subdomain, 80)),
    name: str(body.name, 100).trim(), email: str(body.email, 254).trim(), phone: str(body.phone, 30).trim(), password: str(body.password, 128), acceptedTerms: body.acceptedTerms === true,
    plan: PLAN_KEYS.includes(str(body.plan, 20)) ? str(body.plan, 20) : 'free', termMonths: TERMS.includes(term) ? term : null,
  };
}

export async function handleRegister(req: Request, body: Record<string, unknown>): Promise<RegisterResult> {
  const input = parseRegisterBody(body);
  const problems = validateRegister(input);
  if (Object.keys(problems).length) return fail(problems);
  if (useMocks()) {
    if (MOCK_TAKEN_SUBDOMAINS.includes(input.subdomain)) return fail({ subdomain: 'subdomainTaken' });
    if (input.email.toLowerCase() === MOCK_TAKEN_EMAIL_REGISTER) return fail({ email: 'emailTaken' });
    return { ok: true, fields: {}, general: null, handoff: MOCK_REGISTER_HANDOFF };
  }
  const referral = readReferral(req.headers.get('cookie'));
  const track = input.plan === 'free' ? undefined : input.plan;
  const r = await callApi(req, '/auth/register', {
    method: 'POST',
    body: {
      name: input.name, email: input.email, password: input.password, businessName: input.businessName, industry: input.industry || input.categoryKey, ...(input.phone ? { phone: input.phone } : {}),
      ...(track ? { track } : {}), subdomain: input.subdomain,
      ...(referral ? { referralCode: referral.slice(0, 20) } : {}),
    },
  });
  if (!r) return fail({}, 'notAvailable');
  if (!r.ok) { const f = mapRegisterFailure(r.status, r.json); return fail(f.fields, f.general); }
  return { ok: true, fields: {}, general: null, handoff: await requestHandoff(req, accessTokenOf(r.json)) };
}

/** The state of one address: the local rules first (no call for a shape or reserved problem), then the API. 'unknown' when it cannot be checked. */
export async function handleSubdomainCheck(req: Request, slugIn: string): Promise<{ state: SubdomainState }> {
  const slug = cleanSubdomain(slugIn);
  const p = subdomainProblem(slug);
  if (p === 'subdomainReserved') return { state: 'reserved' };
  if (p === 'subdomainShort') return { state: 'short' };
  if (p) return { state: 'invalid' };
  if (useMocks()) return { state: MOCK_TAKEN_SUBDOMAINS.includes(slug) ? 'taken' : 'available' };
  const r = await callApi(req, `/v3/public/subdomain-availability?name=${encodeURIComponent(slug)}`, { method: 'GET' });
  if (!r) return { state: 'unknown' };
  return { state: subdomainStateOf(r.status, r.json) };
}
