import { ActorType, AlertLevel, AlertRuleRow, AlertStatus } from './core/activity-core';

export interface ActivityRow {
  id: string; vendorId: string | null; actorType: ActorType; actorId: string | null; actionKey: string; entityType: string; entityId: string | null;
  summary: Record<string, unknown>; ipHash: string | null; at: Date;
}
export type NewActivity = Omit<ActivityRow, 'id' | 'at'>;

export interface RuleRow extends AlertRuleRow { id: string; updatedByStaffId: string | null; updatedAt: Date }
export type RulePatch = Partial<Pick<AlertRuleRow, 'enabled' | 'thresholdJson' | 'notifyRoles'>>;

export interface AlertRow {
  id: string; vendorId: string; ruleKey: string; level: AlertLevel; status: AlertStatus; ownerStaffId: string | null; activityIds: string[]; note: string | null;
  createdAt: Date; updatedAt: Date; resolvedAt: Date | null;
}
export type NewAlert = Pick<AlertRow, 'vendorId' | 'ruleKey' | 'level' | 'activityIds'>;
export interface AlertFilter { level?: AlertLevel; status?: AlertStatus; vendorId?: string; ownerStaffId?: string }
export interface AlertPatch { status?: AlertStatus; ownerStaffId?: string | null; note?: string | null; resolvedAt?: Date | null }

export interface NotificationRow { id: string; userId: string | null; role: string | null; kind: string; refId: string | null; readAt: Date | null; createdAt: Date }
export type NewNotification = Pick<NotificationRow, 'userId' | 'role' | 'kind' | 'refId'>;

export interface Paged<T> { items: T[]; total: number }

/** Counts the attention board shows. `alertsNew` is the number of NEW alerts by rule key; the queue counts come from rows other slices own, read-only. */
export interface AttentionData { alertsNew: Array<{ ruleKey: string; level: AlertLevel; count: number }>; queues: Record<string, number> }

/**
 * The only way the activity and alert tables are read or written. The activity log has an insert and reads, and NO update or delete: it is append-only (the database refuses both as well).
 * Every vendor read carries the vendor id in the WHERE.
 */
export abstract class ActivityStore {
  abstract insertActivity(d: NewActivity): Promise<ActivityRow>;
  abstract activityForVendor(vendorId: string, skip: number, take: number): Promise<Paged<ActivityRow>>;
  abstract activitiesByIds(ids: string[]): Promise<ActivityRow[]>;

  abstract listRules(): Promise<RuleRow[]>;
  abstract getRule(key: string): Promise<RuleRow | null>;
  /** creates the rows that do not exist yet; never touches an existing row (the loader) */
  abstract createRulesIfMissing(rows: ReadonlyArray<{ key: string; level: AlertLevel; notifyRoles: string[] }>): Promise<string[]>;
  abstract updateRule(key: string, patch: RulePatch, staffId: string | null): Promise<RuleRow | null>;

  abstract insertAlert(d: NewAlert): Promise<AlertRow>;
  abstract listAlerts(f: AlertFilter, skip: number, take: number): Promise<Paged<AlertRow>>;
  abstract getAlert(id: string): Promise<AlertRow | null>;
  /** compare-and-set on the status the caller read, so two staff members cannot overwrite each other unseen */
  abstract updateAlert(id: string, expected: AlertStatus, patch: AlertPatch): Promise<AlertRow | null>;

  abstract insertNotification(d: NewNotification): Promise<NotificationRow>;
  abstract unreadByRole(): Promise<Record<string, number>>;
  abstract attention(): Promise<AttentionData>;
}
