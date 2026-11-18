import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TrialSignupPolicy } from '../v3-trial/trial-signup.policy';
import { DomainAvailability, readTyped, RegistrarHit, shapeAvailability, SubdomainInput, validLabel } from './core/public-availability-core';
import { liveFlags, resolveMargin } from './core/registrar-core';
import { RegistrarPort } from './registrar.port';
import { RegistrarStore } from './registrar.store';

const CACHE_MS = 60_000;
const CACHE_MAX = 500;

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
  private cache = new Map<string, { at: number; hits: RegistrarHit[] }>();

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
    if (hit && now.getTime() - hit.at < CACHE_MS) return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits: hit.hits, registrarFailed: false });
    try {
      const hits = await this.port.search(typed.label, ask);
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, { at: now.getTime(), hits: [...hits] });
      return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits, registrarFailed: false });
    } catch (e) {
      this.logger.warn(`public availability: the registrar did not answer (${e instanceof Error ? e.name : 'error'})`);   // the name only: the message of a registrar error can carry request detail
      return shapeAvailability({ typed, subdomain, registrarOn, tldsOnSale, hits: null, registrarFailed: true });
    }
  }
}
