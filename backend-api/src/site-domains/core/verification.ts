/**
 * Domain ownership check by DNS TXT record (slice 5.6). The expected value is PUBLIC by design (the owner puts it in their DNS), so it is stored in clear.
 * The checker only talks to an injected DnsResolver port; tests use a fake and nothing here opens a socket.
 */
export interface DnsResolver { resolveTxt(name: string): Promise<string[][]> }
export type TxtResult = 'MATCHED' | 'MISMATCH' | 'NOT_FOUND' | 'ERROR';

export const TXT_VALUE_PREFIX = 'g4d-verify=';

/** `randomHex(n)` returns n random hex characters (injected, so this stays pure). */
export function generateTxtValue(randomHex: (chars: number) => string): string { return `${TXT_VALUE_PREFIX}${randomHex(32)}`; }

export function challengeName(prefix: string, hostname: string): string { return `${prefix}.${hostname}`; }

const NOT_THERE = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

export async function checkTxt(dns: DnsResolver, name: string, expected: string): Promise<TxtResult> {
  let records: string[][];
  try { records = await dns.resolveTxt(name); } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    return typeof code === 'string' && NOT_THERE.has(code) ? 'NOT_FOUND' : 'ERROR';
  }
  const values = (records ?? []).map((chunks) => (Array.isArray(chunks) ? chunks.join('') : String(chunks)));
  if (values.includes(expected)) return 'MATCHED';
  return values.some((v) => v.startsWith(TXT_VALUE_PREFIX)) ? 'MISMATCH' : 'NOT_FOUND';
}
