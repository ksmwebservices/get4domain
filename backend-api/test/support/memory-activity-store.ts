import { OtpPepper } from '../../src/directory/pepper';
import { ActivityService, AlertsService } from '../../src/v3-activity/activity.service';
import {
  ActivityRow, ActivityStore, AlertFilter, AlertPatch, AlertRow, AttentionData, NewActivity, NewAlert, NewNotification, NotificationRow, Paged, RulePatch, RuleRow,
} from '../../src/v3-activity/activity.store';
import { ALERT_RULE_KEYS, AlertLevel, AlertStatus, DEFAULT_RULE_LEVEL } from '../../src/v3-activity/core/activity-core';

/**
 * In-memory twin of the Prisma activity store. It mirrors the database rules the unit tests rely on: the log has no update and no delete (the methods do not exist, and `tamper*` helpers prove the
 * trigger text separately), an alert changes only by compare-and-set on its status, a closed alert carries a closing time and an open one does not, a notification needs a person or a role.
 */
export class MemoryActivityStore extends ActivityStore {
  activity: ActivityRow[] = []; rules: RuleRow[] = []; alerts: AlertRow[] = []; notifications: NotificationRow[] = []; queues: Record<string, number> = { serviceRequestsOpen: 0 };
  clock: () => Date = () => new Date(); failInsert = false; failRules = false; private n = 0;
  private id(p: string): string { return `${p}-${++this.n}`; }

  async insertActivity(d: NewActivity): Promise<ActivityRow> {
    if (this.failInsert) throw new Error('database down');
    const row: ActivityRow = { ...d, summary: { ...d.summary }, id: this.id('act'), at: this.clock() }; this.activity.push(row); return { ...row, summary: { ...row.summary } };
  }
  async activityForVendor(vendorId: string, skip: number, take: number): Promise<Paged<ActivityRow>> {
    const all = this.activity.filter((r) => r.vendorId === vendorId).sort((a, b) => b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : -1));
    return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length };
  }
  async activitiesByIds(ids: string[]): Promise<ActivityRow[]> { return this.activity.filter((r) => ids.includes(r.id)).map((r) => ({ ...r })); }

  async listRules(): Promise<RuleRow[]> { if (this.failRules) throw new Error('rules down'); return this.rules.map((r) => ({ ...r })).sort((a, b) => (a.key < b.key ? -1 : 1)); }
  async getRule(key: string): Promise<RuleRow | null> { const r = this.rules.find((x) => x.key === key); return r ? { ...r } : null; }
  async createRulesIfMissing(rows: ReadonlyArray<{ key: string; level: AlertLevel; notifyRoles: string[] }>): Promise<string[]> {
    const made: string[] = [];
    for (const r of rows) if (!this.rules.some((x) => x.key === r.key)) { this.rules.push({ id: this.id('rule'), key: r.key, level: r.level, thresholdJson: null, notifyRoles: [...r.notifyRoles], enabled: false, updatedByStaffId: null, updatedAt: this.clock() }); made.push(r.key); }
    return made;
  }
  async updateRule(key: string, patch: RulePatch, staffId: string | null): Promise<RuleRow | null> {
    const r = this.rules.find((x) => x.key === key); if (!r) return null;
    if (patch.enabled !== undefined) r.enabled = patch.enabled;
    if (patch.thresholdJson !== undefined) r.thresholdJson = patch.thresholdJson;
    if (patch.notifyRoles !== undefined) r.notifyRoles = [...patch.notifyRoles];
    r.updatedByStaffId = staffId; r.updatedAt = this.clock(); return { ...r };
  }

  async insertAlert(d: NewAlert): Promise<AlertRow> {
    const now = this.clock(); const row: AlertRow = { id: this.id('alert'), vendorId: d.vendorId, ruleKey: d.ruleKey, level: d.level, status: 'NEW', ownerStaffId: null, activityIds: [...d.activityIds], note: null, createdAt: now, updatedAt: now, resolvedAt: null };
    this.alerts.push(row); return { ...row };
  }
  async listAlerts(f: AlertFilter, skip: number, take: number): Promise<Paged<AlertRow>> {
    const all = this.alerts.filter((a) => (!f.level || a.level === f.level) && (!f.status || a.status === f.status) && (!f.vendorId || a.vendorId === f.vendorId) && (!f.ownerStaffId || a.ownerStaffId === f.ownerStaffId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
    return { items: all.slice(skip, skip + take).map((a) => ({ ...a })), total: all.length };
  }
  async getAlert(id: string): Promise<AlertRow | null> { const a = this.alerts.find((x) => x.id === id); return a ? { ...a, activityIds: [...a.activityIds] } : null; }
  async updateAlert(id: string, expected: AlertStatus, patch: AlertPatch): Promise<AlertRow | null> {
    const a = this.alerts.find((x) => x.id === id && x.status === expected); if (!a) return null;
    const next = { ...a, ...patch, updatedAt: this.clock() };
    const closed = next.status === 'RESOLVED' || next.status === 'NOT_AN_ISSUE';
    if (closed !== (next.resolvedAt !== null)) throw new Error('check constraint: g4d_alerts_resolved_chk');
    Object.assign(a, next); return { ...a };
  }

  async insertNotification(d: NewNotification): Promise<NotificationRow> {
    if (!d.userId && !d.role) throw new Error('check constraint: g4d_v3_notifications_target_chk');
    const row: NotificationRow = { id: this.id('note'), userId: d.userId, role: d.role, kind: d.kind, refId: d.refId, readAt: null, createdAt: this.clock() }; this.notifications.push(row); return { ...row };
  }
  async unreadByRole(): Promise<Record<string, number>> { const o: Record<string, number> = {}; for (const n of this.notifications) if (!n.readAt && n.role) o[n.role] = (o[n.role] ?? 0) + 1; return o; }
  async attention(): Promise<AttentionData> {
    const by = new Map<string, { ruleKey: string; level: AlertLevel; count: number }>();
    for (const a of this.alerts) if (a.status === 'NEW') { const k = `${a.ruleKey}|${a.level}`; const e = by.get(k) ?? { ruleKey: a.ruleKey, level: a.level, count: 0 }; e.count++; by.set(k, e); }
    return { alertsNew: [...by.values()], queues: { ...this.queues } };
  }
}

export interface ActivityWorld { store: MemoryActivityStore; activity: ActivityService; alerts: AlertsService; now: { t: number }; seedRules: (o?: Record<string, { enabled?: boolean; thresholdJson?: Record<string, number> | null; notifyRoles?: string[] }>) => Promise<void> }

/** A service pair over the memory store with a clock the test moves, and every rule seeded the way the loader seeds them (disabled, no numbers). */
export function activityWorld(): ActivityWorld {
  const store = new MemoryActivityStore(); const now = { t: Date.parse('2026-11-10T10:00:00Z') }; store.clock = () => new Date(now.t);
  const activity = new ActivityService(store, new OtpPepper()); const alerts = new AlertsService(store, activity); alerts.clock = () => new Date(now.t);
  const seedRules: ActivityWorld['seedRules'] = async (o = {}) => {
    await store.createRulesIfMissing(ALERT_RULE_KEYS.map((key) => ({ key, level: DEFAULT_RULE_LEVEL[key], notifyRoles: DEFAULT_RULE_LEVEL[key] === 'LOW' ? [] : ['SUPER_ADMIN', 'OPERATIONS'] })));
    for (const [key, p] of Object.entries(o)) await store.updateRule(key, p, 'seed-staff');
  };
  return { store, activity, alerts, now, seedRules };
}
