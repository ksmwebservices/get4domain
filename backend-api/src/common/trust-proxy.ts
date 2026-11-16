import { isIP } from 'net';

/**
 * Which peers may tell the API who the visitor is (Wave 2, public site gap G15). The rate limits are per client address, and the address is Express `req.ip`, which believes `X-Forwarded-For` only
 * from a TRUSTED peer. Pure: the environment is passed in.
 *
 *   TRUSTED_PROXIES   a comma separated list of the proxies the API trusts: addresses (`10.0.0.5`, `::1`), subnets (`10.0.0.0/24`) and the Express words `loopback`, `linklocal`, `uniquelocal`.
 *                     `X-Forwarded-For` is read ONLY when the direct peer is on this list, and the walk from the right stops at the first address that is not, so a caller outside the list can never
 *                     choose its own address and a visitor cannot dodge its limit by sending the header. Set it to the address the public site's server and nginx connect from.
 *   TRUST_PROXY_HOPS  the older setting (the number of proxy hops, default 1), used only when TRUSTED_PROXIES is not set. It trusts whatever peer is one hop away, so prefer TRUSTED_PROXIES.
 *
 * A list that has no valid entry is ignored (and reported) rather than trusting everything or nothing by accident.
 */
export type TrustProxySetting = number | string[];
export interface TrustProxyResolved { value: TrustProxySetting; source: 'TRUSTED_PROXIES' | 'TRUST_PROXY_HOPS' | 'DEFAULT'; rejected: string[] }

const WORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** null when the entry is acceptable. */
export function trustedProxyProblem(entry: string): string | null {
  if (WORDS.has(entry)) return null;
  const [addr, bits, extra] = entry.split('/');
  const v = isIP(addr);
  if (extra !== undefined || v === 0) return 'is not an address, a subnet or one of loopback, linklocal, uniquelocal';
  if (bits === undefined) return null;
  if (!/^\d{1,3}$/.test(bits) || Number(bits) > (v === 4 ? 32 : 128)) return 'has a bad subnet size';
  return null;
}

export function resolveTrustProxy(env: Readonly<Record<string, string | undefined>>): TrustProxyResolved {
  const listed = (env.TRUSTED_PROXIES ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const good: string[] = []; const rejected: string[] = [];
  for (const e of listed) (trustedProxyProblem(e) === null ? good : rejected).push(e);
  if (good.length) return { value: [...new Set(good)], source: 'TRUSTED_PROXIES', rejected };
  const hops = Number(env.TRUST_PROXY_HOPS);
  if (env.TRUST_PROXY_HOPS !== undefined && env.TRUST_PROXY_HOPS.trim() !== '' && Number.isInteger(hops) && hops >= 0 && hops <= 10) return { value: hops, source: 'TRUST_PROXY_HOPS', rejected };
  return { value: 1, source: 'DEFAULT', rejected };
}
