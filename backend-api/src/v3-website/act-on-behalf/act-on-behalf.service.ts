import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnprocessableEntityException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivityService } from '../../v3-activity/activity.service';
import { reasonProblem } from '../core/review-core';
import { ReviewNotifier } from '../review/review.service';
import { WebsiteSettingsService } from '../settings/website-settings.service';
import { wmBody } from '../website.errors';
import { expiryFor, MAY_END_ANY_SESSION, SessionState, stateOf } from './act-on-behalf-core';
import { ActOnBehalfStore, SessionRow } from './act-on-behalf.store';

export interface StaffRef { id: string; role: string }
export interface SessionView { id: string; vendorId: string; reason: string; startedAt: string; expiresAt: string; endedAt: string | null; endedBy: string | null; state: SessionState }
export interface StaffSessionView extends SessionView { staffId: string }

const err = (status: 'forbidden' | 'conflict' | 'notfound' | 'unprocessable', code: string, message: string): Error => {
  const body = wmBody(code, message);
  return status === 'forbidden' ? new ForbiddenException(body) : status === 'conflict' ? new ConflictException(body) : status === 'notfound' ? new NotFoundException(body) : new UnprocessableEntityException(body);
};

/**
 * Act on behalf of a vendor (slice 5.13b). A session needs a reason, tells the vendor, ends by itself after the staff setting (no default), and every request made inside it is logged against the
 * vendor with the session id (the interceptor). Inside a session staff can never change a payment method, bank detail, UPI id, payee or password (act-on-behalf-core). A staff member has one live session.
 */
@Injectable()
export class ActOnBehalfService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: ActOnBehalfStore, private readonly notifier: ReviewNotifier, private readonly settings: WebsiteSettingsService, @Optional() private readonly activity?: ActivityService) {}

  private view(s: SessionRow): SessionView {
    return { id: s.id, vendorId: s.vendorId, reason: s.reason, startedAt: s.startedAt.toISOString(), expiresAt: s.expiresAt.toISOString(), endedAt: s.endedAt?.toISOString() ?? null, endedBy: s.endedBy, state: stateOf(s, this.clock()) };
  }
  private staffView(s: SessionRow): StaffSessionView { return { ...this.view(s), staffId: s.staffId }; }

  async start(staff: StaffRef, vendorId: string, reason: unknown): Promise<StaffSessionView> {
    const problem = reasonProblem(reason);
    if (problem) throw err('unprocessable', 'REASON_REQUIRED', problem);
    const minutes = (await this.settings.get()).actOnBehalfMaxMinutes;
    if (minutes === null) throw err('conflict', 'ACT_ON_BEHALF_NOT_CONFIGURED', 'Acting on behalf of a vendor is not switched on yet: staff set the session length first.');
    if (!(await this.store.vendorExists(vendorId))) throw err('notfound', 'ACT_ON_BEHALF_VENDOR_NOT_FOUND', 'That vendor does not exist.');
    const now = this.clock();
    const row = await this.store.createIfNoneActive({ staffId: staff.id, vendorId, reason: String(reason).trim(), startedAt: now, expiresAt: expiryFor(now, minutes) });
    if (!row) throw err('conflict', 'SESSION_ACTIVE', 'You already have a session open. End it first.');
    await this.notifier.notify({ userId: vendorId, role: null, kind: 'ACT_ON_BEHALF_STARTED', refId: row.id });
    await this.store.markNotified(row.id, now);
    await this.activity?.record({ vendorId, actor: { type: 'STAFF', id: staff.id }, actionKey: 'act_on_behalf.started', entityType: 'act_on_behalf_session', entityId: row.id, summary: { reasonLength: row.reason.length, expiresAt: row.expiresAt.toISOString() } });
    return this.staffView({ ...row, vendorNotifiedAt: now });
  }

  /** Closes a session that ran out of time, tells the vendor, logs it. False when it was already closed. */
  private async autoEnd(row: SessionRow): Promise<boolean> {
    const ended = await this.store.end(row.id, this.clock(), 'AUTO');
    if (!ended) return false;
    await this.closed(ended, { type: 'SYSTEM', id: null });
    return true;
  }
  private async closed(row: SessionRow, actor: { type: 'STAFF' | 'SYSTEM'; id: string | null }): Promise<void> {
    await this.notifier.notify({ userId: row.vendorId, role: null, kind: 'ACT_ON_BEHALF_ENDED', refId: row.id });
    await this.activity?.record({ vendorId: row.vendorId, actor, actionKey: 'act_on_behalf.ended', entityType: 'act_on_behalf_session', entityId: row.id, summary: { by: row.endedBy } });
  }

  /** The live session a request names, for this staff member and this vendor. A session whose time is up is closed on the spot. */
  async resolve(staffId: string, sessionId: string, vendorId: string): Promise<SessionRow> {
    const row = await this.store.get(sessionId);
    if (!row || row.staffId !== staffId) throw err('forbidden', 'ACT_ON_BEHALF_INVALID', 'That session is not yours or does not exist.');
    const state = stateOf(row, this.clock());
    if (state === 'EXPIRED') { await this.autoEnd(row); throw err('forbidden', 'ACT_ON_BEHALF_EXPIRED', 'That session has ended. Start a new one with a reason.'); }
    if (state === 'ENDED') throw err('forbidden', 'ACT_ON_BEHALF_EXPIRED', 'That session has ended. Start a new one with a reason.');
    if (row.vendorId !== vendorId) throw err('forbidden', 'ACT_ON_BEHALF_WRONG_VENDOR', 'That session is for another vendor.');
    return row;
  }

  /** A refused attempt inside a session is logged for the vendor too. */
  async recordRefused(row: SessionRow, staffId: string, method: string, route: string): Promise<void> {
    await this.activity?.record({ vendorId: row.vendorId, actor: { type: 'STAFF', id: staffId }, actionKey: 'act_on_behalf.refused', entityType: 'act_on_behalf_session', entityId: row.id, summary: { route: `${method.toUpperCase()} ${route}` } });
  }

  async end(staff: StaffRef, sessionId: string): Promise<StaffSessionView> {
    const row = await this.store.get(sessionId);
    if (!row) throw err('notfound', 'SESSION_NOT_FOUND', 'That session does not exist.');
    const mine = row.staffId === staff.id;
    if (!mine && !MAY_END_ANY_SESSION.includes(staff.role)) throw err('forbidden', 'ACT_ON_BEHALF_INVALID', 'That session is not yours.');
    if (row.endedAt) return this.staffView(row);
    const ended = await this.store.end(row.id, this.clock(), mine ? 'STAFF' : 'SUPER_ADMIN');
    if (!ended) return this.staffView((await this.store.get(row.id)) ?? row);
    await this.closed(ended, { type: 'STAFF', id: staff.id });
    return this.staffView(ended);
  }

  /** Closes every session past its time. Safe to repeat. Returns how many it closed. */
  async expireDue(): Promise<number> {
    let n = 0;
    for (const row of await this.store.listDue(this.clock())) if (await this.autoEnd(row)) n++;
    return n;
  }

  async listForStaff(f: { vendorId?: string; active?: boolean; page: number; pageSize: number }): Promise<{ items: StaffSessionView[]; page: number; pageSize: number; total: number }> {
    const r = await this.store.list({ vendorId: f.vendorId, active: f.active }, (f.page - 1) * f.pageSize, f.pageSize);
    return { items: r.items.map((s) => this.staffView(s)), page: f.page, pageSize: f.pageSize, total: r.total };
  }

  /** The vendor's own view: when, why and how long; never which staff member. */
  async listForVendor(vendorId: string): Promise<SessionView[]> { return (await this.store.listForVendor(vendorId, 50)).map((s) => this.view(s)); }
}

/** The sweep (every minute): sessions past their time are closed and the vendor told. Safe to repeat. */
@Injectable()
export class ActOnBehalfCron {
  private readonly logger = new Logger(ActOnBehalfCron.name);
  private busy = false;
  constructor(private readonly svc: ActOnBehalfService) {}
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<number> {
    if (this.busy) return 0;
    this.busy = true;
    try { return await this.svc.expireDue(); } catch (e) { this.logger.error(`act on behalf sweep failed: ${e instanceof Error ? e.name : 'error'}`); return 0; } finally { this.busy = false; }
  }
}
