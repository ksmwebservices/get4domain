/**
 * Pure canonical host choice and redirect plan (slice 5.6). Exactly one primary per vendor; a custom domain is primary only while it is ACTIVE and the plan
 * still allows custom domains; a plan downgrade changes the ANSWER, never the stored rows.
 */
export interface DomainRow { id: string; hostname: string; kind: 'SUBDOMAIN' | 'CUSTOM'; status: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED' | 'REMOVED'; isPrimary: boolean }

const byHostname = (a: DomainRow, b: DomainRow): number => (a.hostname < b.hostname ? -1 : a.hostname > b.hostname ? 1 : 0);

export function choosePrimary(rows: readonly DomainRow[], o: { customAllowed: boolean }): DomainRow | null {
  const active = rows.filter((r) => r.status === 'ACTIVE');
  if (o.customAllowed) {
    const custom = active.filter((r) => r.kind === 'CUSTOM' && r.isPrimary).sort(byHostname);
    if (custom.length) return custom[0];
  }
  const sub = active.filter((r) => r.kind === 'SUBDOMAIN').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || byHostname(a, b));
  return sub[0] ?? null;
}

export type RedirectDecision = { action: 'SERVE' } | { action: 'REDIRECT'; host: string; status: 301 | 302 } | { action: 'UNKNOWN' };
export type WwwPolicy = 'apex' | 'www';

/** What to do with a request for `requestHost` of a vendor whose canonical host is `primaryHost`. The caller keeps the path and query. */
export function planRedirect(i: { requestHost: string; primaryHost: string; ownedHosts: readonly string[]; wwwPolicy: WwwPolicy }): RedirectDecision {
  if (i.requestHost === i.primaryHost) return { action: 'SERVE' };
  if (i.ownedHosts.includes(i.requestHost)) return { action: 'REDIRECT', host: i.primaryHost, status: 301 };
  const isWww = i.requestHost.startsWith('www.');
  const counterpart = isWww ? i.requestHost.slice(4) : `www.${i.requestHost}`;
  const handles = i.wwwPolicy === 'apex' ? isWww : !isWww;   // apex policy folds www into the apex; www policy folds the apex into www
  if (handles && i.ownedHosts.includes(counterpart)) return { action: 'REDIRECT', host: i.primaryHost, status: 301 };
  return { action: 'UNKNOWN' };
}
