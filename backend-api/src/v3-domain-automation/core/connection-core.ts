/**
 * Pure rules of own-domain automation (slice 5.6c): which host is connected, the records a vendor creates, the per-registrar steps and the connection state machine.
 * No clock, randomness, network or database here.
 */

export type ConnectionMode = 'CONNECT' | 'FORWARD';
export type ConnectionStatus = 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'NEEDS_ATTENTION' | 'LAPSED';
export type CertStatus = 'NONE' | 'PENDING' | 'ACTIVE' | 'FAILED';
export type ConnectionEvent = 'HOSTNAME_CREATED' | 'CERT_PENDING' | 'CERT_ACTIVE' | 'CERT_FAILED' | 'GAVE_UP' | 'RETRY' | 'PLAN_LAPSED' | 'PLAN_RESTORED';

/** Two-part public suffixes common for Indian and international domains. A technical list (not a business value): a name directly under one of these is a bare domain. */
const TWO_PART_SUFFIXES: ReadonlySet<string> = new Set([
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in', 'ac.in', 'edu.in', 'res.in', 'gov.in', 'nic.in',
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za', 'com.sg', 'com.my', 'com.br', 'co.jp', 'com.cn', 'com.hk',
]);

export interface ConnectHost { connectHost: string; apex: string; bareDomain: boolean; label: string }

/** www first: a bare domain is connected through its www host and flagged as needing the Cloudflare option; a www host or a subdomain connects as it is. */
export function connectHostFor(hostname: string): ConnectHost {
  const host = hostname.trim().toLowerCase();
  const parts = host.split('.');
  const suffixLen = TWO_PART_SUFFIXES.has(parts.slice(-2).join('.')) ? 2 : 1;
  const apexLen = suffixLen + 1;
  const apex = parts.slice(-apexLen).join('.');
  if (parts.length <= apexLen) return { connectHost: `www.${host}`, apex: host, bareDomain: true, label: 'www' };
  return { connectHost: host, apex, bareDomain: false, label: parts.slice(0, parts.length - apexLen).join('.') };
}

export interface DnsRecord { purpose: 'OWNERSHIP' | 'CONNECT'; type: 'TXT' | 'CNAME'; host: string; hostLabel: string; value: string }
export interface DnsInstructions {
  records: DnsRecord[];
  connectNotice: string | null;
  bareDomain: { needsCloudflareOption: true; text: string } | null;
}

const labelOf = (fullHost: string, hostname: string): string => {
  const { apex } = connectHostFor(hostname);
  return fullHost === apex ? '@' : fullHost.endsWith(`.${apex}`) ? fullHost.slice(0, fullHost.length - apex.length - 1) : fullHost;
};

export const BARE_DOMAIN_TEXT = 'A bare domain (example.in with nothing in front) cannot take a CNAME record at most registrars. We connect the www version first. Showing your site on the bare domain needs an extra option on our side; until it is on, the bare domain can forward to the www address at your registrar.';

export function dnsRecordsFor(i: { hostname: string; txtName: string; txtValue: string; cnameTarget: string | null }): DnsInstructions {
  const c = connectHostFor(i.hostname);
  const records: DnsRecord[] = [{ purpose: 'OWNERSHIP', type: 'TXT', host: i.txtName, hostLabel: labelOf(i.txtName, i.hostname), value: i.txtValue }];
  if (i.cnameTarget) records.push({ purpose: 'CONNECT', type: 'CNAME', host: c.connectHost, hostLabel: c.label, value: i.cnameTarget });
  return {
    records,
    connectNotice: i.cnameTarget ? null : 'The connection address is not ready yet, so only the ownership record is shown for now. The connection record will appear here when it is.',
    bareDomain: c.bareDomain ? { needsCloudflareOption: true, text: BARE_DOMAIN_TEXT } : null,
  };
}

export const REGISTRARS = ['GODADDY', 'NAMECHEAP', 'HOSTINGER', 'BIGROCK', 'OTHER'] as const;
export type RegistrarKey = (typeof REGISTRARS)[number];

const GENERIC = ['Open the DNS settings (also called DNS zone, DNS management or advanced DNS) of your domain.', 'Add each record from the table: the type, the host (name) and the value, exactly as shown.', 'Save the records, then come back here and press Check now.'];
const PLACES: Record<RegistrarKey, { where: string; extra?: string }> = {
  GODADDY: { where: 'Sign in to GoDaddy, open My Products, choose your domain and press DNS.', extra: 'In GoDaddy the host for the www record is just www, and the host of the ownership record is the part before your domain name.' },
  NAMECHEAP: { where: 'Sign in to Namecheap, open Domain List, press Manage next to your domain and open Advanced DNS.', extra: 'In Namecheap use Add New Record and choose the type; the host is the label without your domain name.' },
  HOSTINGER: { where: 'Sign in to Hostinger, open Domains, choose your domain and open DNS / Nameservers.', extra: 'In Hostinger the name field takes the label without your domain name.' },
  BIGROCK: { where: 'Sign in to BigRock, open Manage Domain for your domain and choose DNS Management.', extra: 'In BigRock add the records under the DNS management section and save each one.' },
  OTHER: { where: 'Sign in to the company where you bought your domain and find its DNS settings.' },
};

/** Plain steps for one registrar. Wording avoids timeframes. A bare domain adds the explanation that a CNAME is not possible there. */
export function registrarSteps(key: RegistrarKey, o: { bareDomain: boolean }): string[] {
  const p = PLACES[key];
  const steps = [p.where, ...GENERIC];
  if (p.extra) steps.splice(2, 0, p.extra);
  if (o.bareDomain) steps.push(key === 'GODADDY' ? 'GoDaddy: a bare domain cannot take a CNAME record, so the connection record goes on the www host. To also open your site from the bare domain, use GoDaddy forwarding to the www address.' : 'A bare domain does not take a CNAME record at most registrars, so the connection record goes on the www host.');
  return steps;
}

const MOVES: Record<ConnectionStatus, Partial<Record<ConnectionEvent, ConnectionStatus>>> = {
  PENDING: { HOSTNAME_CREATED: 'VERIFYING', GAVE_UP: 'NEEDS_ATTENTION' },
  VERIFYING: { CERT_PENDING: 'VERIFYING', CERT_ACTIVE: 'ACTIVE', CERT_FAILED: 'NEEDS_ATTENTION', GAVE_UP: 'NEEDS_ATTENTION' },
  ACTIVE: { CERT_ACTIVE: 'ACTIVE', CERT_FAILED: 'NEEDS_ATTENTION', PLAN_LAPSED: 'LAPSED' },
  NEEDS_ATTENTION: { RETRY: 'PENDING' },
  /** owner answer Q11: after grace the vendor's host redirects to the subdomain; the domain stays the vendor's and the connection returns with Pro */
  LAPSED: { PLAN_RESTORED: 'VERIFYING' },
};
/** The next status for an event, or null when the move is not allowed. */
export function nextConnection(from: ConnectionStatus, ev: ConnectionEvent): ConnectionStatus | null { return MOVES[from][ev] ?? null; }

export interface RedirectPlan { fromHost: string; toHost: string; status: 301 }
/** Forward mode sends visitors to the Get4Domain subdomain; connect mode serves the site on the vendor's own host and plans no redirect. */
export function redirectTargetFor(mode: ConnectionMode, connectHost: string, subdomainHost: string): RedirectPlan | null { return mode === 'FORWARD' ? { fromHost: connectHost, toHost: subdomainHost, status: 301 } : null; }

/** After the plan lapses the vendor's own host sends visitors to the Get4Domain subdomain with a temporary redirect (it comes back with Pro). */
export const lapseRedirectFor = (connectHost: string, subdomainHost: string): { fromHost: string; toHost: string; status: 302 } => ({ fromHost: connectHost, toHost: subdomainHost, status: 302 });
