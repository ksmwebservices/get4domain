import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlertLevel, AlertStatus } from './core/activity-core';
import {
  ActivityRow, ActivityStore, AlertFilter, AlertPatch, AlertRow, AttentionData, NewActivity, NewAlert, NewNotification, NotificationRow, Paged, RulePatch, RuleRow,
} from './activity.store';

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const thresholds = (v: unknown): Record<string, number> | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
  return out;
};
const toActivity = (r: Prisma.V3ActivityLogGetPayload<Record<string, never>>): ActivityRow => ({
  id: r.id, vendorId: r.vendorId, actorType: r.actorType, actorId: r.actorId, actionKey: r.actionKey, entityType: r.entityType, entityId: r.entityId, summary: obj(r.summaryJson), ipHash: r.ipHash, at: r.at,
});
const toRule = (r: Prisma.V3AlertRuleGetPayload<Record<string, never>>): RuleRow => ({
  id: r.id, key: r.key, level: r.level, thresholdJson: thresholds(r.thresholdJson), notifyRoles: r.notifyRoles, enabled: r.enabled, updatedByStaffId: r.updatedByStaffId, updatedAt: r.updatedAt,
});
const toAlert = (r: Prisma.V3AlertGetPayload<Record<string, never>>): AlertRow => ({
  id: r.id, vendorId: r.vendorId, ruleKey: r.ruleKey, level: r.level, status: r.status, ownerStaffId: r.ownerStaffId, activityIds: r.activityIds, note: r.note, createdAt: r.createdAt, updatedAt: r.updatedAt, resolvedAt: r.resolvedAt,
});
const toNotification = (r: Prisma.V3NotificationGetPayload<Record<string, never>>): NotificationRow => ({ id: r.id, userId: r.userId, role: r.role, kind: r.kind, refId: r.refId, readAt: r.readAt, createdAt: r.createdAt });

/** Service requests that are waiting on our team: a read-only count of rows another slice owns. */
const OPEN_FOR_TEAM = ['REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'REVISION_REQUESTED'] as const;

@Injectable()
export class PrismaActivityStore extends ActivityStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async insertActivity(d: NewActivity): Promise<ActivityRow> {
    return toActivity(await this.prisma.v3ActivityLog.create({
      data: { vendorId: d.vendorId, actorType: d.actorType, actorId: d.actorId, actionKey: d.actionKey, entityType: d.entityType, entityId: d.entityId, summaryJson: d.summary as Prisma.InputJsonValue, ipHash: d.ipHash },
    }));
  }
  async activityForVendor(vendorId: string, skip: number, take: number): Promise<Paged<ActivityRow>> {
    const where = { vendorId };
    const [items, total] = await Promise.all([this.prisma.v3ActivityLog.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3ActivityLog.count({ where })]);
    return { items: items.map(toActivity), total };
  }
  async activitiesByIds(ids: string[]): Promise<ActivityRow[]> { return ids.length ? (await this.prisma.v3ActivityLog.findMany({ where: { id: { in: ids } }, orderBy: { at: 'asc' } })).map(toActivity) : []; }

  async listRules(): Promise<RuleRow[]> { return (await this.prisma.v3AlertRule.findMany({ orderBy: { key: 'asc' } })).map(toRule); }
  async getRule(key: string): Promise<RuleRow | null> { const r = await this.prisma.v3AlertRule.findUnique({ where: { key } }); return r ? toRule(r) : null; }
  async createRulesIfMissing(rows: ReadonlyArray<{ key: string; level: AlertLevel; notifyRoles: string[] }>): Promise<string[]> {
    const have = new Set((await this.prisma.v3AlertRule.findMany({ where: { key: { in: rows.map((r) => r.key) } }, select: { key: true } })).map((r) => r.key));
    const todo = rows.filter((r) => !have.has(r.key));
    if (todo.length) await this.prisma.v3AlertRule.createMany({ data: todo.map((r) => ({ key: r.key, level: r.level, notifyRoles: r.notifyRoles, enabled: false })), skipDuplicates: true });
    return todo.map((r) => r.key);
  }
  async updateRule(key: string, patch: RulePatch, staffId: string | null): Promise<RuleRow | null> {
    const data: Prisma.V3AlertRuleUpdateInput = { updatedByStaffId: staffId };
    if (patch.enabled !== undefined) data.enabled = patch.enabled;
    if (patch.notifyRoles !== undefined) data.notifyRoles = patch.notifyRoles;
    if (patch.thresholdJson !== undefined) data.thresholdJson = patch.thresholdJson === null ? Prisma.DbNull : (patch.thresholdJson as Prisma.InputJsonValue);
    const n = await this.prisma.v3AlertRule.updateMany({ where: { key }, data });
    return n.count === 1 ? this.getRule(key) : null;
  }

  async insertAlert(d: NewAlert): Promise<AlertRow> { return toAlert(await this.prisma.v3Alert.create({ data: { vendorId: d.vendorId, ruleKey: d.ruleKey, level: d.level, activityIds: d.activityIds } })); }
  async listAlerts(f: AlertFilter, skip: number, take: number): Promise<Paged<AlertRow>> {
    const where: Prisma.V3AlertWhereInput = { ...(f.level ? { level: f.level } : {}), ...(f.status ? { status: f.status } : {}), ...(f.vendorId ? { vendorId: f.vendorId } : {}), ...(f.ownerStaffId ? { ownerStaffId: f.ownerStaffId } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3Alert.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3Alert.count({ where })]);
    return { items: items.map(toAlert), total };
  }
  async getAlert(id: string): Promise<AlertRow | null> { const r = await this.prisma.v3Alert.findUnique({ where: { id } }); return r ? toAlert(r) : null; }
  async updateAlert(id: string, expected: AlertStatus, patch: AlertPatch): Promise<AlertRow | null> {
    const n = await this.prisma.v3Alert.updateMany({ where: { id, status: expected }, data: { ...patch } });
    return n.count === 1 ? this.getAlert(id) : null;
  }

  async insertNotification(d: NewNotification): Promise<NotificationRow> { return toNotification(await this.prisma.v3Notification.create({ data: { userId: d.userId, role: d.role, kind: d.kind, refId: d.refId } })); }
  async unreadByRole(): Promise<Record<string, number>> {
    const rows = await this.prisma.v3Notification.groupBy({ by: ['role'], where: { readAt: null, role: { not: null } }, _count: { _all: true } });
    const out: Record<string, number> = {};
    for (const r of rows) if (r.role) out[r.role] = r._count._all;
    return out;
  }
  async attention(): Promise<AttentionData> {
    const [alerts, openRequests, reportsNew, proofsToCheck, proofsMissing] = await Promise.all([
      this.prisma.v3Alert.groupBy({ by: ['ruleKey', 'level'], where: { status: 'NEW' }, _count: { _all: true } }),
      this.prisma.v3ServiceRequest.count({ where: { status: { in: [...OPEN_FOR_TEAM] } } }),
      // slice 5.21, read-only counts of rows the trust slice owns
      this.prisma.v3BusinessReport.count({ where: { status: 'NEW' } }),
      this.prisma.v3BusinessProof.count({ where: { status: 'SUBMITTED' } }),
      // a vendor on a current Pro plan with no business proof at all (proof is optional; the missing one is a Medium attention item, never a refusal)
      this.prisma.vendor.count({ where: { v3BusinessProofs: { none: {} }, v3Subscriptions: { some: { status: { in: ['ACTIVE', 'GRACE'] }, plan: { level: 'PRO' } } } } }),
    ]);
    return { alertsNew: alerts.map((a) => ({ ruleKey: a.ruleKey, level: a.level, count: a._count._all })), queues: { serviceRequestsOpen: openRequests, reportsNew, proofsToCheck, proofsMissing } };
  }
}
