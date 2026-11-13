import { Injectable, Logger, Optional } from '@nestjs/common';
import { KeyedQueue } from '../common/keyed-queue';
import { Actor } from '../plans/admin/audit.service';
import { SubscriptionsService } from '../plans/subscriptions/subscriptions.service';
import { PayeeNameCheckPort } from '../v3-trust/trust.ports';
import { adminError } from './admin-actions.errors';
import { AdminActionsStore, MergeRow, NameHistoryRow, PlanChangeRow } from './admin-actions.store';
import { cleanBusinessName, cleanReason, mergeWindowOpen, planCustomerMerge, planKeyOk, termMonthsOk } from './core/admin-actions-core';
import { effectiveWhen, reversibleUntil } from './time';
import { AdminActionsSettingsService } from './settings/admin-actions-settings';

const queue = new KeyedQueue();
const nameView = (h: NameHistoryRow) => ({ id: h.id, oldName: h.oldName, newName: h.newName, reason: h.reason, changedBy: h.actorId, at: h.createdAt });
const changeView = (c: PlanChangeRow) => ({ id: c.id, planKey: c.planKey, termMonths: c.termMonths, effectiveAt: c.effectiveAt, status: c.status, reason: c.reason, requestedBy: c.requestedBy, appliedAt: c.appliedAt, error: c.error, createdAt: c.createdAt });
const mergeView = (m: MergeRow) => ({ id: m.id, keepVendorId: m.keepVendorId, mergedVendorId: m.mergedVendorId, status: m.status, movedCustomers: m.moved.customerIds.length, conflicts: m.conflicts, reason: m.reason, by: m.actorId, reversibleUntil: m.reversibleUntil, reversedAt: m.reversedAt, createdAt: m.createdAt });
const reasonOrThrow = (v: unknown): string => { const r = cleanReason(v); if (!r) throw adminError(400, 'ADMIN_INVALID', 'A reason of 5 to 300 characters is required.'); return r; };

/**
 * Staff actions on a business (Amendment 09 Part A). Every one needs a written reason and every signed-in route is written to the activity log by the activity interceptor.
 * A1 plan change with an effective date, A2 business name, A4 merging two listings (contacts only here). A3 (delete an empty listing) is the existing lifecycle action.
 */
@Injectable()
export class AdminActionsService {
  private readonly logger = new Logger(AdminActionsService.name);
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: AdminActionsStore, private readonly subscriptions: SubscriptionsService, private readonly settings: AdminActionsSettingsService,
    @Optional() private readonly payee?: PayeeNameCheckPort,
  ) {}

  private async vendorOrThrow(id: string) { const v = await this.store.vendor(String(id).slice(0, 64)); if (!v) throw adminError(404, 'ADMIN_VENDOR_NOT_FOUND', 'That business does not exist.'); return v; }

  // ── A2: the business name ──
  /** Changes the name (free sites too). The old name is kept in the history. The payee-name check runs again on every active UPI method so a mismatch raises its alert. */
  async changeBusinessName(vendorId: string, actor: Actor, b: { businessName?: unknown; reason?: unknown }) {
    const v = await this.vendorOrThrow(vendorId); const reason = reasonOrThrow(b.reason);
    const name = cleanBusinessName(b.businessName); if (!name) throw adminError(400, 'ADMIN_INVALID', 'The business name must be 2 to 120 characters on one line, without angle brackets.');
    if (name === v.businessName) throw adminError(409, 'ADMIN_NO_CHANGE', 'That is already the business name.');
    const oldName = v.businessName;   // read before the write: the result must name the name that was replaced
    await this.store.rename(v.id, oldName, name, reason, actor.id, this.clock());
    let recheck = 0;
    if (this.payee) { try { for (const p of await this.store.payeeNames(v.id)) { await this.payee.check(v.id, p); recheck++; } } catch (e) { this.logger.warn(`payee re-check failed: ${e instanceof Error ? e.name : 'error'}`); } }
    return { vendorId: v.id, oldName, newName: name, payeeChecksRun: recheck };
  }
  async nameHistory(vendorId: string, page: number, pageSize: number) { await this.vendorOrThrow(vendorId); const r = await this.store.nameHistory(vendorId, (page - 1) * pageSize, pageSize); return { items: r.items.map(nameView), total: r.total }; }

  // ── A1: a plan change with an effective date ──
  /**
   * Change a business's plan to any plan, now or at a date. A change that is due now goes through the one plan assignment at once (the entitlements recalculate; a downgrade follows the Stage 6 rules:
   * Pro features turn off and the data is kept). A later date is stored PENDING and applied by the job when it is due; it can be cancelled until then.
   */
  async requestPlanChange(vendorId: string, actor: Actor, b: { planKey?: unknown; termMonths?: unknown; effectiveAt?: unknown; reason?: unknown }) {
    const v = await this.vendorOrThrow(vendorId); const reason = reasonOrThrow(b.reason); const now = this.clock();
    if (!planKeyOk(b.planKey)) throw adminError(400, 'ADMIN_INVALID', 'Choose a plan.');
    if (b.termMonths !== undefined && b.termMonths !== null && !termMonthsOk(b.termMonths)) throw adminError(400, 'ADMIN_INVALID', 'The term is a whole number of months.');
    const when = effectiveWhen(b.effectiveAt, now); if (!when) throw adminError(400, 'ADMIN_INVALID', 'The effective date is not a valid date.');
    if (!(await this.store.planExists(b.planKey))) throw adminError(404, 'ADMIN_PLAN_UNKNOWN', 'That plan does not exist.');
    const termMonths = typeof b.termMonths === 'number' ? b.termMonths : null;
    if (when.when === 'LATER') return changeView(await this.store.createPlanChange({ vendorId: v.id, planKey: b.planKey, termMonths, effectiveAt: when.at, reason, requestedBy: actor.id, status: 'PENDING', appliedAt: null }));
    await this.subscriptions.assignPlan({ vendorId: v.id, planKey: b.planKey, termMonths, endsAt: null, source: 'STAFF', actor, reason });
    return changeView(await this.store.createPlanChange({ vendorId: v.id, planKey: b.planKey, termMonths, effectiveAt: now, reason, requestedBy: actor.id, status: 'APPLIED', appliedAt: now }));
  }
  async listPlanChanges(vendorId: string, page: number, pageSize: number) { await this.vendorOrThrow(vendorId); const r = await this.store.listPlanChanges(vendorId, (page - 1) * pageSize, pageSize); return { items: r.items.map(changeView), total: r.total }; }
  async cancelPlanChange(id: string) {
    const c = await this.store.getPlanChange(String(id).slice(0, 64)); if (!c) throw adminError(404, 'ADMIN_PLAN_CHANGE_NOT_FOUND', 'That plan change does not exist.');
    if (!(await this.store.cancelPlanChange(c.id))) throw adminError(409, 'ADMIN_PLAN_CHANGE_STATE', 'Only a change that is still waiting can be cancelled.');
    return changeView({ ...c, status: 'CANCELLED' });
  }
  /** The job: applies every pending change whose date has come. Safe to repeat and to run twice at once (each change is claimed once). A failure is recorded on the change and never stops the others. */
  async applyDuePlanChanges(limit = 100): Promise<{ applied: number; failed: number }> {
    let applied = 0; let failed = 0; const now = this.clock();
    for (const c of await this.store.duePlanChanges(now, limit)) {
      if (!(await this.store.claimPlanChange(c.id))) continue;
      try {
        await this.subscriptions.assignPlan({ vendorId: c.vendorId, planKey: c.planKey, termMonths: c.termMonths, endsAt: null, source: 'STAFF', actor: { type: 'SYSTEM', id: null, ip: null }, reason: `Scheduled change: ${c.reason}`.slice(0, 300) });
        await this.store.finishPlanChange(c.id, 'APPLIED', this.clock(), null); applied++;
      } catch (e) { await this.store.finishPlanChange(c.id, 'FAILED', this.clock(), (e instanceof Error ? e.message : 'error').slice(0, 200)); failed++; }
    }
    return { applied, failed };
  }

  // ── A4: merging two listings (contacts only in this slice) ──
  /** What a merge would do, without doing it: which contacts would move and which stay because the kept business already has that person. */
  async planMerge(keepId: string, mergeId: string) {
    const { keep, merged } = await this.mergeSides(keepId, mergeId);
    const plan = planCustomerMerge(await this.store.customersOf(keep.id), await this.store.customersOf(merged.id));
    return { keepVendorId: keep.id, mergedVendorId: merged.id, wouldMoveCustomers: plan.move.length, conflicts: plan.conflicts, keepCustomers: plan.keepCount, mergedCustomers: plan.mergeCount, enabled: (await this.settings.get()).adminMergeReversalDays !== null };
  }
  /** Merges the second listing into the first: its contacts move to the kept business. Money history, orders, sales and payments stay on the original with this record as the pointer. Reversible until the window ends. */
  async merge(actor: Actor, b: { keepVendorId?: unknown; mergedVendorId?: unknown; reason?: unknown }) {
    const days = (await this.settings.get()).adminMergeReversalDays;
    if (days === null) throw adminError(409, 'ADMIN_MERGE_NOT_ENABLED', 'Merging listings is switched off until staff set how many days a merge can be undone.');
    const reason = reasonOrThrow(b.reason); const { keep, merged } = await this.mergeSides(b.keepVendorId, b.mergedVendorId);
    return queue.run(`merge:${[keep.id, merged.id].sort().join(':')}`, async () => {
      const plan = planCustomerMerge(await this.store.customersOf(keep.id), await this.store.customersOf(merged.id));
      try { return mergeView(await this.store.applyMerge({ keepVendorId: keep.id, mergedVendorId: merged.id, reason, actorId: actor.id, customerIds: plan.move, conflicts: plan.conflicts, reversibleUntil: reversibleUntil(this.clock(), days) })); }
      catch (e) { this.logger.warn(`merge failed: ${e instanceof Error ? e.name : 'error'}`); throw adminError(409, 'ADMIN_MERGE_STATE', 'The merge could not be completed because a contact changed at the same time. Nothing was moved. Try again.'); }
    });
  }
  async reverseMerge(actor: Actor, id: string, reasonIn: unknown) {
    const reason = reasonOrThrow(reasonIn); const m = await this.store.getMerge(String(id).slice(0, 64)); if (!m) throw adminError(404, 'ADMIN_MERGE_NOT_FOUND', 'That merge does not exist.');
    if (m.status !== 'APPLIED') throw adminError(409, 'ADMIN_MERGE_STATE', 'That merge was already undone.');
    if (!mergeWindowOpen(m.reversibleUntil.getTime(), this.clock().getTime())) throw adminError(409, 'ADMIN_MERGE_WINDOW_ENDED', 'The time to undo this merge has ended.');
    const r = await queue.run(`merge:${[m.keepVendorId, m.mergedVendorId].sort().join(':')}`, () => this.store.reverseMerge(m.id, actor.id, reason, this.clock()));
    if (!r) throw adminError(409, 'ADMIN_MERGE_STATE', 'That merge was already undone.');
    return { id: m.id, status: 'REVERSED', restoredCustomers: r.restored, notRestored: r.left };
  }
  async listMerges(vendorId: string | null, page: number, pageSize: number) { const r = await this.store.listMerges(vendorId, (page - 1) * pageSize, pageSize); return { items: r.items.map(mergeView), total: r.total }; }
  private async mergeSides(keepId: unknown, mergeId: unknown) {
    if (typeof keepId !== 'string' || typeof mergeId !== 'string' || !keepId || !mergeId) throw adminError(400, 'ADMIN_MERGE_INVALID', 'Name the listing to keep and the listing to merge into it.');
    if (keepId === mergeId) throw adminError(400, 'ADMIN_MERGE_INVALID', 'A listing cannot be merged into itself.');
    return { keep: await this.vendorOrThrow(keepId), merged: await this.vendorOrThrow(mergeId) };
  }
}
