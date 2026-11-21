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

export interface CanonicalPlan {
  /** the one canonical host of the site (owner rule 4), or null when the vendor has no usable host */
  canonicalHost: string | null;
  canonicalKind: 'SUBDOMAIN' | 'CUSTOM' | null;
  subdomainHost: string | null;
  /** the ACTIVE verified custom domain, if any */
  customHost: string | null;
  /** hosts that serve the same site without redirecting (custom domains while the subdomain is canonical) */
  serveHosts: string[];
  reason: 'DEFAULT_SUBDOMAIN' | 'ADDON_CUSTOM' | 'NO_HOST';
}

/**
 * Owner rule 4: exactly ONE canonical host per site. The default is the subdomain; an ACTIVE verified custom domain serves the same site and declares the subdomain canonical.
 * While the custom-domain promotion add-on is active (and a custom domain is ACTIVE) the custom domain is canonical and the subdomain redirects to it. Nothing here looks at the
 * plan: a downgrade, an expiry or a suspension never stops a custom domain from serving, and the add-on follows its own end date. Pure; the rows are never changed.
 */
export function canonicalHostFor(i: { rows: readonly DomainRow[]; legacyHost: string | null; addonActive: boolean; /** owner answer Q11: false once the plan has lapsed past grace; the custom domain then stops serving and the subdomain is canonical. Omitted = true. */ customServing?: boolean }): CanonicalPlan {
  if (i.customServing === false) {
    const own = i.rows.filter((r) => r.status === 'ACTIVE');
    const sub = own.filter((r) => r.kind === 'SUBDOMAIN').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || byHostname(a, b))[0]?.hostname ?? i.legacyHost;
    const custom = own.filter((r) => r.kind === 'CUSTOM').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || byHostname(a, b))[0]?.hostname ?? null;
    return sub ? { canonicalHost: sub, canonicalKind: 'SUBDOMAIN', subdomainHost: sub, customHost: custom, serveHosts: [], reason: 'DEFAULT_SUBDOMAIN' } : { canonicalHost: custom, canonicalKind: custom ? 'CUSTOM' : null, subdomainHost: null, customHost: custom, serveHosts: [], reason: custom ? 'DEFAULT_SUBDOMAIN' : 'NO_HOST' };
  }
  const active = i.rows.filter((r) => r.status === 'ACTIVE');
  const subRow = active.filter((r) => r.kind === 'SUBDOMAIN').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || byHostname(a, b))[0];
  const customs = active.filter((r) => r.kind === 'CUSTOM').sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || byHostname(a, b));
  const subdomainHost = subRow?.hostname ?? i.legacyHost;
  const customHost = customs[0]?.hostname ?? null;
  if (i.addonActive && customHost) return { canonicalHost: customHost, canonicalKind: 'CUSTOM', subdomainHost, customHost, serveHosts: [], reason: 'ADDON_CUSTOM' };
  if (subdomainHost) return { canonicalHost: subdomainHost, canonicalKind: 'SUBDOMAIN', subdomainHost, customHost, serveHosts: customs.map((c) => c.hostname), reason: 'DEFAULT_SUBDOMAIN' };
  if (customHost) return { canonicalHost: customHost, canonicalKind: 'CUSTOM', subdomainHost: null, customHost, serveHosts: [], reason: 'DEFAULT_SUBDOMAIN' };   // no subdomain at all (should not happen: it is mandatory)
  return { canonicalHost: null, canonicalKind: null, subdomainHost: null, customHost: null, serveHosts: [], reason: 'NO_HOST' };
}

export type RedirectDecision = { action: 'SERVE' } | { action: 'REDIRECT'; host: string; status: 301 | 302 } | { action: 'UNKNOWN' };
export type WwwPolicy = 'apex' | 'www';

/** What to do with a request for `requestHost` of a vendor whose canonical host is `primaryHost`. The caller keeps the path and query. */
export function planRedirect(i: { requestHost: string; primaryHost: string; ownedHosts: readonly string[]; wwwPolicy: WwwPolicy; /** hosts that serve the site as it is while another host is canonical */ serveHosts?: readonly string[]; /** custom hosts that redirect only for now (the plan has lapsed): a temporary redirect, because they come back with Pro */ temporaryHosts?: readonly string[] }): RedirectDecision {
  if (i.requestHost === i.primaryHost) return { action: 'SERVE' };
  if (i.serveHosts?.includes(i.requestHost)) return { action: 'SERVE' };
  if (i.ownedHosts.includes(i.requestHost)) return { action: 'REDIRECT', host: i.primaryHost, status: i.temporaryHosts?.includes(i.requestHost) ? 302 : 301 };
  const isWww = i.requestHost.startsWith('www.');
  const counterpart = isWww ? i.requestHost.slice(4) : `www.${i.requestHost}`;
  const handles = i.wwwPolicy === 'apex' ? isWww : !isWww;   // apex policy folds www into the apex; www policy folds the apex into www
  if (handles && i.ownedHosts.includes(counterpart)) return { action: 'REDIRECT', host: i.primaryHost, status: 301 };
  return { action: 'UNKNOWN' };
}
