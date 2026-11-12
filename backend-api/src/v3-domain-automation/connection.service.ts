import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { planError } from '../plans/plans.errors';
import { Actor } from '../plans/admin/audit.service';
import { CanonicalSwitchService } from '../site-domains/canonical-switch.service';
import { HostDirectory } from '../site-domains/host-directory';
import { challengeName } from '../site-domains/core/verification';
import { DomainSettingsService } from '../site-domains/settings/domain-settings.service';
import { CloudflareError, CloudflarePort } from './cloudflare.port';
import { ConnectionMode, ConnectionStatus, connectHostFor, dnsRecordsFor, lapseRedirectFor, nextConnection, redirectTargetFor, RegistrarKey, REGISTRARS, registrarSteps } from './core/connection-core';
import { ConnectionRow, ConnectionStore } from './connection.store';
import { AutomationSettingsService } from './settings/automation-settings';

/** Stable machine codes of the connection routes. A screen switches on `code`. */
export const CONNECTION_ERROR_CODES = ['CONNECTION_NOT_FOUND', 'CONNECTION_STATE_INVALID', 'CONNECTION_NOT_READY', 'CONNECTION_CHECK_TOO_SOON', 'CONNECTION_PROVIDER_FAILED'] as const;
type ConnectionErrorCode = (typeof CONNECTION_ERROR_CODES)[number];
const err = (code: ConnectionErrorCode, message: string): { message: string; code: ConnectionErrorCode } => ({ message, code });
const SYSTEM: Actor = { type: 'SYSTEM', id: null, ip: null };
/** A technical limit, not a business value: how many times one provider call is tried before the connection needs attention. */
const CALL_TRIES = 3;

export interface ConnectionView {
  id: string; domainId: string; hostname: string; connectHost: string; bareDomain: boolean; needsCloudflareOption: boolean; mode: ConnectionMode; status: ConnectionStatus; certStatus: string; sslStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'FAILED';
  failureReason: string | null; lastCheckedAt: Date | null; activatedAt: Date | null;
}

/**
 * Own-domain automation (slice 5.6c): after the TXT ownership check, create the Cloudflare custom hostname (www first; a bare domain is flagged), watch the certificate, then serve the site on the vendor's
 * host (CONNECT) or redirect it to the Get4Domain subdomain (FORWARD). The canonical host is never written here: every change goes through CanonicalSwitchService.switchFor, which records it in both
 * directions. A lapse of anything here never hides the site: the Get4Domain subdomain keeps serving.
 */
@Injectable()
export class DomainConnectionService {
  private readonly logger = new Logger(DomainConnectionService.name);
  clock: () => Date = () => new Date();

  constructor(
    private readonly store: ConnectionStore, private readonly cf: CloudflarePort, private readonly settings: AutomationSettingsService, private readonly domainSettings: DomainSettingsService,
    private readonly canonical: CanonicalSwitchService, private readonly dir: HostDirectory, private readonly ents: EntitlementsService, @Optional() private readonly bus?: ActivityBus,
  ) {}

  private emit(type: string, row: ConnectionRow, actor: Actor, data: Record<string, unknown> = {}): void {
    void this.bus?.emit({ type, vendorId: row.vendorId, at: this.clock(), actor: { type: actor.type, id: actor.id }, data: { domainId: row.domainId, hostname: row.hostname, ...data } });
  }
  private view(r: ConnectionRow): ConnectionView {
    return {
      id: r.id, domainId: r.domainId, hostname: r.hostname, connectHost: r.connectHost, bareDomain: r.bareDomain, needsCloudflareOption: r.bareDomain, mode: r.mode, status: r.status, certStatus: r.certStatus,
      sslStatus: r.certStatus === 'ACTIVE' ? 'ACTIVE' : r.certStatus === 'FAILED' ? 'FAILED' : r.certStatus === 'PENDING' ? 'PENDING' : 'NONE', failureReason: r.failureReason, lastCheckedAt: r.lastCheckedAt, activatedAt: r.activatedAt,
    };
  }
  private async load(vendorId: string, domainId: string): Promise<ConnectionRow> {
    const r = typeof domainId === 'string' && domainId ? await this.store.forDomain(vendorId, domainId) : null;
    if (!r) throw new NotFoundException(err('CONNECTION_NOT_FOUND', 'That domain has no connection yet.'));
    return r;
  }

  private async proAllowed(vendorId: string): Promise<boolean> { return (await this.ents.resolve(vendorId)).features['site.custom_domain']?.state === 'ACTIVE'; }

  // ─────────────────────────────────────────────────────────────────────────────────── what the vendor sees
  /** The records to create, the steps for the registrar the vendor named, and the connection if there is one. */
  async guide(vendorId: string, domainId: string, registrarIn?: string) {
    const d = await this.store.domain(vendorId, domainId);
    if (!d || d.kind !== 'CUSTOM' || d.status === 'REMOVED') throw new NotFoundException(err('CONNECTION_NOT_FOUND', 'That domain does not exist.'));
    const registrar: RegistrarKey = (REGISTRARS as readonly string[]).includes(String(registrarIn)) ? (registrarIn as RegistrarKey) : 'OTHER';
    const [s, ds, txt, row] = await Promise.all([this.settings.get(), this.domainSettings.get(), this.store.txtValue(vendorId, domainId), this.store.forDomain(vendorId, domainId)]);
    const instructions = dnsRecordsFor({ hostname: d.hostname, txtName: challengeName(ds.verificationTxtPrefix, d.hostname), txtValue: txt ?? '', cnameTarget: s.customHostnameTarget });
    return { domainId, hostname: d.hostname, ownership: d.status === 'ACTIVE' ? 'VERIFIED' : 'WAITING', ...instructions, registrar, steps: registrarSteps(registrar, { bareDomain: instructions.bareDomain !== null }), registrars: [...REGISTRARS], connection: row ? this.view(row) : null };
  }

  async get(vendorId: string, domainId: string): Promise<ConnectionView> { return this.view(await this.load(vendorId, domainId)); }
  async listForVendor(vendorId: string): Promise<ConnectionView[]> { return (await this.store.listForVendor(vendorId)).map((r) => this.view(r)); }
  async listForStaff(q: { status?: ConnectionStatus; skip: number; take: number }) { const r = await this.store.listForStaff({ status: q.status }, q.skip, q.take); return { items: r.items.map((x) => this.view(x)), total: r.total }; }

  // ─────────────────────────────────────────────────────────────────────────────────── start
  /** Starts the connection of a domain whose ownership is verified. Starting again returns the same connection. */
  async begin(vendorId: string, domainId: string, input: { mode?: ConnectionMode; registrar?: string }, actor: Actor): Promise<ConnectionView> {
    const mode: ConnectionMode = input.mode === 'FORWARD' ? 'FORWARD' : 'CONNECT';
    if (input.mode !== undefined && input.mode !== 'CONNECT' && input.mode !== 'FORWARD') throw new BadRequestException(err('CONNECTION_STATE_INVALID', 'Choose connect or forward.'));
    const d = await this.store.domain(vendorId, domainId);
    if (!d || d.kind !== 'CUSTOM' || d.status === 'REMOVED') throw new NotFoundException(err('CONNECTION_NOT_FOUND', 'That domain does not exist.'));
    if (!(await this.proAllowed(vendorId))) throw new ForbiddenException(planError('FEATURE_LOCKED', 'Using your own web address is part of a higher plan.', { feature: 'site.custom_domain' }));
    if (d.status !== 'ACTIVE') throw new ConflictException(err('CONNECTION_NOT_READY', 'Your ownership of this domain has to be confirmed first.'));
    const s = await this.settings.get();
    if (!s.customHostnameTarget) throw new ConflictException(err('CONNECTION_NOT_READY', 'Automatic connection is not ready yet.'));
    const existing = await this.store.forDomain(vendorId, domainId);
    if (existing) return this.view(existing);
    const c = connectHostFor(d.hostname);
    const registrar = (REGISTRARS as readonly string[]).includes(String(input.registrar)) ? String(input.registrar) : null;
    const row = await this.store.create({ vendorId, domainId, hostname: d.hostname, connectHost: c.connectHost, bareDomain: c.bareDomain, mode, registrar });
    if (!row) return this.view((await this.store.forDomain(vendorId, domainId))!);   // a second request at the same moment: the first one's row
    const out = await this.createHostname(row);
    this.emit('domain.connection_started', row, actor, { mode });
    return this.view(out);
  }

  /** Creates the hostname with the provider, trying again on a temporary failure; an exhausted or refused call needs attention. */
  private async createHostname(row: ConnectionRow): Promise<ConnectionRow> {
    let attempts = row.attempts; let last: CloudflareError | null = null;
    for (let i = 0; i < CALL_TRIES; i++) {
      attempts++;
      try {
        const h = await this.cf.createCustomHostname(row.connectHost);
        const to = nextConnection(row.status, 'HOSTNAME_CREATED')!;
        return (await this.store.update(row.vendorId, row.id, ['PENDING'], { status: to, cfHostnameId: h.id, certStatus: h.certStatus === 'NONE' ? 'PENDING' : h.certStatus, attempts: 0, failureReason: null, lastCheckedAt: this.clock() })) ?? (await this.store.get(row.vendorId, row.id))!;
      } catch (e) {
        last = e instanceof CloudflareError ? e : new CloudflareError('PROVIDER_ERROR', false);
        if (!last.retryable) break;
      }
    }
    this.logger.warn(`custom hostname not created for connection ${row.id}: ${last?.message ?? 'error'}`);
    const to = nextConnection(row.status, 'GAVE_UP')!;
    return (await this.store.update(row.vendorId, row.id, ['PENDING'], { status: to, attempts, failureReason: last?.message ?? 'PROVIDER_ERROR', lastCheckedAt: this.clock() })) ?? (await this.store.get(row.vendorId, row.id))!;
  }

  // ─────────────────────────────────────────────────────────────────────────────────── check (the vendor's button and the watcher)
  async check(vendorId: string, domainId: string, actor: Actor, o: { fromWatcher?: boolean } = {}): Promise<ConnectionView> {
    const row = await this.load(vendorId, domainId);
    return this.view(await this.checkRow(row, actor, o));
  }

  async checkRow(row: ConnectionRow, actor: Actor, o: { fromWatcher?: boolean } = {}): Promise<ConnectionRow> {
    const s = await this.settings.get(); const now = this.clock();
    if (!o.fromWatcher && s.connectionCheckMinIntervalSeconds && row.lastCheckedAt && now.getTime() - row.lastCheckedAt.getTime() < s.connectionCheckMinIntervalSeconds * 1000) {
      throw new HttpException(err('CONNECTION_CHECK_TOO_SOON', 'Please wait a little before checking again.'), 429);
    }
    if (row.status === 'PENDING') { const made = row.cfHostnameId ? row : await this.createHostname(row); return made; }
    if (row.status === 'NEEDS_ATTENTION' || row.status === 'LAPSED' || !row.cfHostnameId) return row;
    let state;
    try { state = await this.cf.getCustomHostname(row.cfHostnameId); } catch (e) {
      if (e instanceof CloudflareError && e.retryable) return (await this.store.update(row.vendorId, row.id, [row.status], { lastCheckedAt: now })) ?? row;   // a temporary failure changes nothing
      throw new ConflictException(err('CONNECTION_PROVIDER_FAILED', 'We could not check the connection just now.'));
    }
    const ev = state.certStatus === 'ACTIVE' ? 'CERT_ACTIVE' : state.certStatus === 'FAILED' ? 'CERT_FAILED' : 'CERT_PENDING';
    const to = nextConnection(row.status, ev);
    const checks = row.attempts + 1;
    if (to === null) return row;
    const gaveUp = to === 'VERIFYING' && s.connectionMaxChecks !== null && checks >= s.connectionMaxChecks;
    const final: ConnectionStatus = gaveUp ? nextConnection('VERIFYING', 'GAVE_UP')! : to;
    const patch = { status: final, certStatus: state.certStatus === 'NONE' ? ('PENDING' as const) : state.certStatus, attempts: checks, lastCheckedAt: now, failureReason: final === 'NEEDS_ATTENTION' ? (state.reason ?? (gaveUp ? 'CERTIFICATE_NOT_ISSUED' : 'CERTIFICATE_FAILED')) : null, ...(final === 'ACTIVE' && row.status !== 'ACTIVE' ? { activatedAt: now } : {}) };
    const next = await this.store.update(row.vendorId, row.id, [row.status], patch);
    if (!next) return (await this.store.get(row.vendorId, row.id)) ?? row;
    if (row.status !== 'ACTIVE' && final === 'ACTIVE') await this.applyMode(next, actor);
    else if (row.status === 'ACTIVE' && final === 'NEEDS_ATTENTION') { await this.dropRedirect(next); await this.afterChange(next, actor, 'connection_lost'); }
    return next;
  }

  // ─────────────────────────────────────────────────────────────────────────────────── mode
  async setMode(vendorId: string, domainId: string, mode: ConnectionMode, actor: Actor): Promise<ConnectionView> {
    if (mode !== 'CONNECT' && mode !== 'FORWARD') throw new BadRequestException(err('CONNECTION_STATE_INVALID', 'Choose connect or forward.'));
    const row = await this.load(vendorId, domainId);
    if (row.mode === mode) return this.view(row);
    const next = await this.store.update(vendorId, row.id, [row.status], { mode });
    if (!next) throw new ConflictException(err('CONNECTION_STATE_INVALID', 'The connection changed. Please look again.'));
    if (next.status === 'ACTIVE') await this.applyMode(next, actor);
    else this.emit('domain.connection_mode_changed', next, actor, { mode });
    return this.view(next);
  }

  /** ACTIVE: CONNECT serves the site on the vendor's host; FORWARD redirects it to the subdomain. Either way the canonical host is decided by the rule, through the switch service. */
  private async applyMode(row: ConnectionRow, actor: Actor): Promise<void> {
    const sub = await this.store.subdomainHost(row.vendorId);
    const plan = sub ? redirectTargetFor(row.mode, row.connectHost, sub) : null;
    try {
      if (plan) await this.cf.setRedirect(plan.fromHost, plan.toHost, plan.status); else await this.cf.removeRedirect(row.connectHost);
    } catch (e) {
      this.logger.warn(`redirect not applied for connection ${row.id}: ${e instanceof Error ? e.message : 'error'}`);
      await this.store.update(row.vendorId, row.id, ['ACTIVE'], { status: 'NEEDS_ATTENTION', failureReason: 'REDIRECT_NOT_APPLIED' });
    }
    await this.afterChange(row, actor, row.mode === 'FORWARD' ? 'connection_forwarding' : 'connection_active');
  }

  private async dropRedirect(row: ConnectionRow): Promise<void> { try { await this.cf.removeRedirect(row.connectHost); } catch { /* the next check tries again; the subdomain serves meanwhile */ } }

  private async afterChange(row: ConnectionRow, actor: Actor, what: string): Promise<void> {
    this.dir.invalidate();
    try { await this.canonical.switchFor(row.vendorId, actor, 'DOMAIN_CHANGED'); } catch (e) { this.logger.warn(`canonical switch after a connection change failed for ${row.vendorId}: ${e instanceof Error ? e.name : 'error'}`); }
    this.emit(`domain.${what}`, row, actor, { mode: row.mode });
  }

  // ─────────────────────────────────────────────────────────────────────────────────── end and retry
  async disconnect(vendorId: string, domainId: string, actor: Actor): Promise<ConnectionView> {
    const row = await this.load(vendorId, domainId);
    if (row.cfHostnameId) { try { await this.cf.deleteCustomHostname(row.cfHostnameId); } catch (e) { if (!(e instanceof CloudflareError)) throw e; } }
    await this.dropRedirect(row);
    const next = await this.store.update(vendorId, row.id, ['PENDING', 'VERIFYING', 'ACTIVE', 'NEEDS_ATTENTION'], { status: 'NEEDS_ATTENTION', certStatus: 'NONE', cfHostnameId: null, failureReason: 'DISCONNECTED' });
    if (!next) throw new ConflictException(err('CONNECTION_STATE_INVALID', 'The connection changed. Please look again.'));
    await this.afterChange(next, actor, 'connection_ended');
    return this.view(next);
  }

  async retry(vendorId: string, domainId: string, actor: Actor): Promise<ConnectionView> {
    const row = await this.load(vendorId, domainId);
    const to = nextConnection(row.status, 'RETRY');
    if (to === null) throw new ConflictException(err('CONNECTION_STATE_INVALID', 'Only a connection that needs attention can be tried again.'));
    const reset = await this.store.update(row.vendorId, row.id, ['NEEDS_ATTENTION'], { status: to, attempts: 0, failureReason: null });
    if (!reset) return this.view((await this.store.get(row.vendorId, row.id)) ?? row);
    const made = await this.createHostname(reset);
    this.emit('domain.connection_retried', made, actor);
    return this.view(made);
  }

  /**
   * Owner answer Q11. Once the plan no longer allows custom domains (after grace) a live connection lapses: the vendor's host redirects to the Get4Domain subdomain and the canonical host returns to it, through the switch
   * service. The domain stays the vendor's. When Pro returns the connection checks its certificate again and serves. Safe to run again; the watcher runs it for every connection.
   */
  async syncPlan(row: ConnectionRow, actor: Actor): Promise<ConnectionRow> {
    const allowed = await this.proAllowed(row.vendorId);
    if (!allowed && row.status === 'ACTIVE') {
      const next = await this.store.update(row.vendorId, row.id, ['ACTIVE'], { status: nextConnection('ACTIVE', 'PLAN_LAPSED')!, failureReason: 'PLAN_LAPSED' });
      if (!next) return (await this.store.get(row.vendorId, row.id)) ?? row;
      const sub = await this.store.subdomainHost(row.vendorId);
      if (sub) { const r = lapseRedirectFor(row.connectHost, sub); try { await this.cf.setRedirect(r.fromHost, r.toHost, r.status); } catch (e) { this.logger.warn(`lapse redirect not applied for connection ${row.id}: ${e instanceof Error ? e.message : 'error'}`); } }
      await this.afterChange(next, actor, 'redirect_on_lapse');
      return next;
    }
    if (allowed && row.status === 'LAPSED') {
      const next = await this.store.update(row.vendorId, row.id, ['LAPSED'], { status: nextConnection('LAPSED', 'PLAN_RESTORED')!, failureReason: null, attempts: 0 });
      if (!next) return (await this.store.get(row.vendorId, row.id)) ?? row;
      await this.dropRedirect(next);
      await this.afterChange(next, actor, 'connection_restored');
      return next;
    }
    return row;
  }

  /** The watcher: certificate checks for every connection that is waiting or live, least recently checked first. A failure on one row never stops the others. */
  async watchTick(limit = 100): Promise<{ checked: number }> {
    if (!(await this.settings.get()).connectionWatcherEnabled) return { checked: 0 };
    let checked = 0;
    for (const r of await this.store.watchList(limit)) {
      try { const cur = await this.syncPlan(r, SYSTEM); if (cur.status === 'LAPSED') continue; await this.checkRow(cur, SYSTEM, { fromWatcher: true }); checked++; } catch (e) { this.logger.warn(`connection ${r.id} check failed: ${e instanceof Error ? e.name : 'error'}`); }
    }
    return { checked };
  }
}
