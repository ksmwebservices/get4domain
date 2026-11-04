import { ResolvedEntitlements } from '../../src/plans/entitlements/entitlement-engine';
import { DnsResolver } from '../../src/site-domains/core/verification';
import { HostDirectory } from '../../src/site-domains/host-directory';
import { SiteDomainsService } from '../../src/site-domains/site-domains.service';
import { DEFAULT_DOMAIN_SETTINGS, DomainSettings } from '../../src/site-domains/settings/domain-settings';
import { entitlements } from './site-fixtures';
import { MemoryDomainRepo } from './memory-domain-repo';

export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const OWNER = (id: string) => ({ type: 'VENDOR' as const, id, ip: null });
export const BASE = DEFAULT_DOMAIN_SETTINGS.baseDomain;

export interface DomainWorld {
  repo: MemoryDomainRepo; svc: SiteDomainsService; dir: HostDirectory;
  now: { t: Date }; settings: { over: Partial<DomainSettings> };
  ents: Map<string, ResolvedEntitlements>; gate: { dns: DnsResolver | null; calls: number };
  invalidated: { count: number }; txt: { answers: string[][] | Error };
}

/** A domain service and host directory over the in-memory repository, a fake DNS, a fake clock and fake entitlements (Free unless a test says Pro). */
export function domainWorld(): DomainWorld {
  const repo = new MemoryDomainRepo();
  const now = { t: new Date(T0) };
  repo.clock = () => new Date(now.t);
  const settings = { over: {} as Partial<DomainSettings> };
  const ents = new Map<string, ResolvedEntitlements>();
  const entService = { resolve: async (v: string) => ents.get(v) ?? entitlements('FREE') };
  const txt = { answers: [] as string[][] | Error };
  const gate = { dns: null as DnsResolver | null, calls: 0 };
  const dnsGate = { resolver: async () => gate.dns };
  const settingsService = { get: async () => ({ ...DEFAULT_DOMAIN_SETTINGS, ...settings.over }) };
  const dir = new HostDirectory(repo, settingsService as never, entService as never);
  dir.clock = () => new Date(now.t);
  const invalidated = { count: 0 };
  const realInvalidate = dir.invalidate.bind(dir);
  dir.invalidate = () => { invalidated.count++; realInvalidate(); };
  const svc = new SiteDomainsService(repo, settingsService as never, entService as never, dnsGate as never, dir);
  svc.clock = () => new Date(now.t);
  let n = 0;
  svc.random = (chars: number) => String(++n).padStart(chars, '0');
  gate.dns = { resolveTxt: async () => { gate.calls++; if (txt.answers instanceof Error) throw txt.answers; return txt.answers; } };
  return { repo, svc, dir, now, settings, ents, gate, invalidated, txt };
}
export const pro = (): ResolvedEntitlements => entitlements('PRO');
export const advance = (w: DomainWorld, seconds: number): void => { w.now.t = new Date(w.now.t.getTime() + seconds * 1000); };
