import { Injectable, Logger, Optional } from '@nestjs/common';
import { OtpPepper } from '../directory/pepper';
import { ActivityStore, ActivityRow, AlertFilter, AlertRow, RuleRow } from './activity.store';
import { alertInvalid, alertNotFound, alertStale, ruleInvalid, ruleNeedsThreshold, ruleUnknown } from './activity.errors';
import {
  ActorType, ALERT_RULE_KEYS, AlertLevel, AlertStatus, evaluateAlerts, maskSummary,
} from './core/activity-core';

/** Who did it. 'VENDOR' (the word the other modules use) is stored as VENDOR_USER. */
export interface ActivityActor { type: 'VENDOR' | 'VENDOR_USER' | 'STAFF' | 'SYSTEM'; id: string | null; ip?: string | null }
export interface RecordInput { vendorId: string | null; actor: ActivityActor; actionKey: string; entityType: string; entityId?: string | null; summary?: unknown }

const STAFF_ROLES = ['SUPER_ADMIN', 'OPERATIONS'] as const;
/** The numbers each rule may carry. A rule that needs one cannot be switched on until staff have set it. */
const RULE_NUMBERS: Readonly<Record<string, readonly string[]>> = { CAMPAIGN_SPIKE: ['dailyCap', 'complaints', 'stops'], PAYMENT_FAILURES: ['count'], LARGE_IMPORT: ['rows'] };
const NEEDS_ALL: Readonly<Record<string, readonly string[]>> = { PAYMENT_FAILURES: ['count'], LARGE_IMPORT: ['rows'] };
const NEEDS_ANY: Readonly<Record<string, readonly string[]>> = { CAMPAIGN_SPIKE: ['dailyCap', 'complaints', 'stops'] };
/** A closed alert can only be looked at again; an open one can go anywhere. */
const NEXT: Readonly<Record<AlertStatus, readonly AlertStatus[]>> = { NEW: ['LOOKING', 'RESOLVED', 'NOT_AN_ISSUE'], LOOKING: ['NEW', 'RESOLVED', 'NOT_AN_ISSUE'], RESOLVED: ['LOOKING'], NOT_AN_ISSUE: ['LOOKING'] };
const CLOSED: ReadonlySet<AlertStatus> = new Set<AlertStatus>(['RESOLVED', 'NOT_AN_ISSUE']);

const actorType = (t: ActivityActor['type']): ActorType => (t === 'VENDOR' ? 'VENDOR_USER' : t);
const clip = (s: string | null | undefined, n: number): string | null => (s === null || s === undefined ? null : String(s).slice(0, n));

/**
 * The one door into the activity log (slice 5.20). Every V3 module that changes vendor data calls `record()`. It masks the summary, hashes the address, stores the row, then lets the alert rules look at it.
 * `record()` NEVER throws into the caller: a logging fault must not undo or block a vendor's action that has already happened. The fault is logged by name only and `null` is returned.
 * An alert is a notice. Nothing here hides, deletes, freezes or blocks anything.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  constructor(private readonly store: ActivityStore, @Optional() private readonly pepper?: OtpPepper) {}

  async record(i: RecordInput): Promise<ActivityRow | null> {
    try {
      const row = await this.store.insertActivity({
        vendorId: i.vendorId ? String(i.vendorId).slice(0, 64) : null, actorType: actorType(i.actor.type), actorId: clip(i.actor.id, 64), actionKey: String(i.actionKey).slice(0, 120),
        entityType: String(i.entityType).slice(0, 80), entityId: clip(i.entityId ?? null, 120), summary: maskSummary(i.summary), ipHash: this.pepper?.hashIp(i.actor.ip ?? null) ?? null,
      });
      await this.raiseAlerts(row);
      return row;
    } catch (e) {
      this.logger.warn(`activity record failed for ${String(i.actionKey).slice(0, 60)}: ${e instanceof Error ? e.name : 'error'}`);
      return null;
    }
  }

  /** Looks at one stored activity row with the enabled rules, writes the alerts (never for a log-only rule) and tells the roles in the rule. A fault here never loses the activity row. */
  private async raiseAlerts(row: ActivityRow): Promise<void> {
    try {
      const rules = (await this.store.listRules()).filter((r) => r.enabled);
      if (!rules.length) return;
      for (const d of evaluateAlerts({ activityId: row.id, vendorId: row.vendorId, actionKey: row.actionKey, summary: row.summary }, rules)) {
        if (d.logOnly) continue;
        const alert = await this.store.insertAlert({ vendorId: d.vendorId, ruleKey: d.ruleKey, level: d.level, activityIds: d.activityIds });
        for (const role of rules.find((r) => r.key === d.ruleKey)?.notifyRoles ?? []) await this.store.insertNotification({ userId: null, role, kind: `ALERT_${d.level}`, refId: alert.id });
      }
    } catch (e) { this.logger.warn(`alert evaluation failed for ${row.actionKey.slice(0, 60)}: ${e instanceof Error ? e.name : 'error'}`); }
  }

  // ── reads ───────────────────────────────────────────────────────────────────────────────────────────

  /** A vendor's own rows. The vendor id comes from the signed-in principal; the address hash is never shown. */
  async myActivity(vendorId: string, page: number, pageSize: number): Promise<{ items: Array<Omit<ActivityRow, 'ipHash'>>; page: number; pageSize: number; total: number }> {
    const r = await this.store.activityForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items.map(({ ipHash: _ip, ...rest }) => rest), page, pageSize, total: r.total };
  }

  /** Staff view of one vendor's rows (same masked summary). */
  async vendorActivity(vendorId: string, page: number, pageSize: number): Promise<{ items: ActivityRow[]; page: number; pageSize: number; total: number }> {
    const r = await this.store.activityForVendor(vendorId, (page - 1) * pageSize, pageSize);
    return { items: r.items, page, pageSize, total: r.total };
  }
}

/** Staff side of the alerts: list, change, the rules, and the attention board. */
@Injectable()
export class AlertsService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: ActivityStore, private readonly activity: ActivityService) {}

  async list(f: AlertFilter, page: number, pageSize: number): Promise<{ items: AlertRow[]; page: number; pageSize: number; total: number }> {
    const r = await this.store.listAlerts(f, (page - 1) * pageSize, pageSize);
    return { items: r.items, page, pageSize, total: r.total };
  }

  /** The alert with the activity rows behind it. */
  async detail(id: string): Promise<{ alert: AlertRow; activity: ActivityRow[] }> {
    const alert = await this.store.getAlert(id);
    if (!alert) throw alertNotFound();
    return { alert, activity: await this.store.activitiesByIds(alert.activityIds) };
  }

  /** Change status, owner or note. `expectedStatus` is the status the staff member saw; if it moved meanwhile the change is refused. An alert never changes anything else in the system. */
  async update(id: string, by: { id: string | null; ip: string | null }, input: { expectedStatus: AlertStatus; status?: AlertStatus; ownerStaffId?: string | null; note?: string | null }): Promise<AlertRow> {
    const current = await this.store.getAlert(id);
    if (!current) throw alertNotFound();
    if (current.status !== input.expectedStatus) throw alertStale();
    const next = input.status ?? current.status;
    if (next !== current.status && !NEXT[current.status].includes(next)) throw alertInvalid(`An alert that is ${current.status} cannot go to ${next}.`);
    const patch = {
      ...(input.status !== undefined ? { status: next } : {}), ...(input.ownerStaffId !== undefined ? { ownerStaffId: input.ownerStaffId } : {}), ...(input.note !== undefined ? { note: input.note === null ? null : String(input.note).slice(0, 2000) } : {}),
      ...(next !== current.status ? { resolvedAt: CLOSED.has(next) ? this.clock() : null } : {}),
    };
    const done = await this.store.updateAlert(id, current.status, patch);
    if (!done) throw alertStale();
    await this.activity.record({ vendorId: done.vendorId, actor: { type: 'STAFF', id: by.id, ip: by.ip }, actionKey: 'alert.updated', entityType: 'alert', entityId: id, summary: { ruleKey: done.ruleKey, from: current.status, to: done.status, ownerChanged: input.ownerStaffId !== undefined, noteChanged: input.note !== undefined } });
    return done;
  }

  rules(): Promise<RuleRow[]> { return this.store.listRules(); }

  /** SUPER_ADMIN sets the numbers, the roles and the on switch of one rule. The key and the level of a rule are fixed. A rule that needs numbers cannot be switched on until it has them (no number is invented). */
  async updateRule(key: string, by: { id: string | null; ip: string | null }, input: { enabled?: boolean; thresholdJson?: Record<string, number> | null; notifyRoles?: string[] }): Promise<RuleRow> {
    if (!(ALERT_RULE_KEYS as readonly string[]).includes(key)) throw ruleUnknown();
    const current = await this.store.getRule(key);
    if (!current) throw ruleUnknown();
    const allowed = RULE_NUMBERS[key] ?? [];
    let thresholds = input.thresholdJson;
    if (thresholds !== undefined && thresholds !== null) {
      for (const [k, v] of Object.entries(thresholds)) {
        if (!allowed.includes(k)) throw ruleInvalid(`${key} has no number called ${k}.`);
        if (!Number.isInteger(v) || v < 1) throw ruleInvalid(`${k} must be a whole number above zero.`);
      }
      if (!Object.keys(thresholds).length) thresholds = null;
    }
    if (input.notifyRoles !== undefined) for (const r of input.notifyRoles) if (!(STAFF_ROLES as readonly string[]).includes(r)) throw ruleInvalid('Alerts can be sent to SUPER_ADMIN and OPERATIONS only.');
    const finalThresholds = thresholds === undefined ? current.thresholdJson : thresholds;
    const enabled = input.enabled ?? current.enabled;
    if (enabled) {
      const t = finalThresholds ?? {};
      if ((NEEDS_ALL[key] ?? []).some((k) => !(k in t)) || (NEEDS_ANY[key] && !NEEDS_ANY[key].some((k) => k in t))) throw ruleNeedsThreshold(key);
    }
    const updated = await this.store.updateRule(key, { ...(input.enabled !== undefined ? { enabled } : {}), ...(thresholds !== undefined ? { thresholdJson: thresholds } : {}), ...(input.notifyRoles !== undefined ? { notifyRoles: [...new Set(input.notifyRoles)] } : {}) }, by.id);
    if (!updated) throw ruleUnknown();
    await this.activity.record({ vendorId: null, actor: { type: 'STAFF', id: by.id, ip: by.ip }, actionKey: 'alert_rule.updated', entityType: 'alert_rule', entityId: key, summary: { enabled: updated.enabled, thresholds: updated.thresholdJson, notifyRoles: updated.notifyRoles } });
    return updated;
  }

  /** Counts for the staff board: NEW alerts by level for each role that is told about the rule, unread in-app notices per role, and the queues other slices own. */
  async attention(): Promise<{ roles: Record<string, { alertsNew: Record<AlertLevel, number>; unreadNotifications: number }>; queues: Record<string, number>; items: Array<{ key: string; level: AlertLevel; count: number }> }> {
    const [data, rules, unread] = await Promise.all([this.store.attention(), this.store.listRules(), this.store.unreadByRole()]);
    const roles: Record<string, { alertsNew: Record<AlertLevel, number>; unreadNotifications: number }> = {};
    for (const role of STAFF_ROLES) {
      const alertsNew: Record<AlertLevel, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      for (const a of data.alertsNew) if (rules.find((r) => r.key === a.ruleKey)?.notifyRoles.includes(role)) alertsNew[a.level] += a.count;
      roles[role] = { alertsNew, unreadNotifications: unread[role] ?? 0 };
    }
    // a missing business proof is a Medium attention item (slice 5.21): it never blocks anything, it only waits on the board
    const items = [{ key: 'BUSINESS_PROOF_MISSING', level: 'MEDIUM' as AlertLevel, count: data.queues.proofsMissing ?? 0 }];
    return { roles, queues: data.queues, items };
  }
}
