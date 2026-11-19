import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TrialSignupPolicy } from '../v3-trial/trial-signup.policy';
import { DomainAvailability, readTyped, RegistrarFailure, RegistrarHit, shapeAvailability, SubdomainInput, validLabel } from './core/public-availability-core';
import { liveFlags, resolveMargin } from './core/registrar-core';
import { RegistrarError, RegistrarPort } from './registrar.port';
import { RegistrarStore } from './registrar.store';

const CACHE_MS = 60_000;
const CACHE_MAX = 500;
/** R1.2: at most this many calls to the registrar per minute from the whole public route (the route is also throttled per visitor). Beyond it a name that is not cached answers UNKNOWN (try again). */
export const REGISTRAR_CALLS_PER_MINUTE = 30;

/** The failure codes of the registrar as the public states. A failure that cannot be classified is the generic one. */
export function failureOf(e: unknown): RegistrarFailure {
  const code = e instanceof RegistrarError ? e.code : '';
  if (code === 'REGISTRAR_KEYS_MISSING') return 'NOT_CONFIGURED';
  if (code === 'REGISTRAR_NOT_AUTHORISED' || code === 'REGISTRAR_BAD_KEYS') return 'ACCESS_DENIED';
  if (code === 'REGISTRAR_TIMEOUT') return 'TIMEOUT';
  return 'UNREACHABLE';
}

/**
 * B3.6 the public availability route behind the signup form and the custom-domain box. No login, nothing private: the subdomain answer is the existing signup check (same rules, same similar-name
 * warning), and the custom-domain answer comes from the registrar only while REGISTRAR_LIVE_SEARCH is on. With it off the registrar is never asked and the answer says so. A registrar failure
 * is UNKNOWN, never available. No price is returned (a price needs a signed-in vendor, a tax state and the wallet). A name is asked of the registrar at most once a minute (a small cache), so a visitor
 * typing cannot burn through the registrar's allowance.
 */
@Injectable()
export class PublicDomainAvailabilityService {
  private readonly logger = new Logger(PublicDomainAvailabilityService.name);
  clock: () => Date = () => new Date();
  env: () => Record<string, string | undefined> = () => process.env;
  private cache = new Map<string, { at: number; hits: RegistrarHit[]; suggestions: string[] }>();
  private calls: number[] = [];

  constructor(private readonly store: RegistrarStore, private readonly port: RegistrarPort, @Optional() @Inject(TrialSignupPolicy) private readonly subdomains?: Pick<TrialSignupPolicy, 'check'>) {}

  async check(input: unknown): Promise<DomainAvailability> {
    const typed = readTyped(input);
    const subdomain = this.subdomains && typed.label ? ((await this.subdomains.check(typed.label)) as SubdomainInput) : null;
    const registrarOn = liveFlags(this.env()).search;
    if (!registrarOn || !validLabel(typed.label)) return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale: [], hits: null, registrarFailed: false });

    const now = this.clock();
    const rows = await this.store.margins();
    const tldsOnSale = [...new Set(rows.map((r) => r.tld).filter((t) => t !== 'privacy' && !t.startsWith('transfer.')))].filter((t) => resolveMargin(rows, t, now));
    if (tldsOnSale.length === 0 || (typed.tld !== null && !tldsOnSale.includes(typed.tld))) return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits: null, registrarFailed: false });

    const ask = typed.tld ? [typed.tld] : tldsOnSale;
    const key = `${typed.label}|${[...ask].sort().join(',')}`;
    const hit = this.cache.get(key);
    if (hit && now.getTime() - hit.at < CACHE_MS) return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits: hit.hits, registrarFailed: false, suggestions: hit.suggestions });
    this.calls = this.calls.filter((t) => now.getTime() - t < 60_000);
    if (this.calls.length >= REGISTRAR_CALLS_PER_MINUTE) return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits: null, registrarFailed: true, failure: 'BUSY' });   // throttled: never a guess
    this.calls.push(now.getTime());
    try {
      const hits = await this.port.search(typed.label, ask);
      let suggestions: string[] = [];
      if (hits.length > 0 && hits.every((h) => h.status === 'TAKEN') && this.calls.length < REGISTRAR_CALLS_PER_MINUTE) {
        this.calls.push(now.getTime());
        try { suggestions = (await this.port.suggest(typed.label, tldsOnSale, 5)).map((x) => x.domain); } catch { suggestions = []; }   // a suggestion is a nicety: its failure never changes the answer
      }
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, { at: now.getTime(), hits: [...hits], suggestions });
      return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits, registrarFailed: false, suggestions });
    } catch (e) {
      this.logger.warn(`public availability: the registrar did not answer (${e instanceof Error ? e.name : 'error'}, ${e instanceof RegistrarError ? e.code : 'unclassified'})`);   // the name and the registered code only: the message of a registrar error can carry request detail
      return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits: null, registrarFailed: true, failure: failureOf(e) });
    }
  }
}
