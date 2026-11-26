import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileFieldsService, SaveResult } from '../v3-profile-fields/profile.service';
import { ActOnBehalfService, StaffRef } from '../v3-website/act-on-behalf/act-on-behalf.service';
import { ActOnBehalfStore } from '../v3-website/act-on-behalf/act-on-behalf.store';
import { wmBody } from '../v3-website/website.errors';
import { Change, DraftView, EditorView, WebsiteService } from '../v3-website/website.service';

/** One staff request: who is asking, the actor for the records, and the act-on-behalf session it ran in (set by the interceptor once it has checked the header; null without one). */
export interface StaffWrite { staff: StaffRef; actor: Actor; sessionId: string | null }

export interface StaffItemRow { itemId: string; name: string; category: string | null; price: string | null; active: boolean; hasPage: boolean }
/** An item page already written in the draft. `itemName` is null when the item no longer exists. */
export interface StaffItemPageRow { itemId: string; title: string; status: string; area: string; itemName: string | null; itemActive: boolean }
export interface StaffItemList { items: StaffItemRow[]; total: number; page: number; pageSize: number; itemPages: StaffItemPageRow[] }

/**
 * E9a: staff edit a business's website draft. Every change goes through the same service as the owner's own edit, so the field rules, the plan limits and the wording check are identical.
 * Two rules come on top: the role rule (SALES only as the telecaller who created the business) and, for a change, a live act-on-behalf session. The session holds the written reason and tells the
 * owner; the activity row of the request names the staff member and the session. Together they record who changed what, and why.
 */
@Injectable()
export class AdminDraftService {
  constructor(private readonly web: WebsiteService, private readonly sessions: ActOnBehalfService, private readonly sessionStore: ActOnBehalfStore, private readonly profile: ProfileFieldsService, private readonly prisma: PrismaService) {}

  private async mayEdit(staff: StaffRef, vendorId: string): Promise<void> {
    await this.sessions.assertMayAct(staff, vendorId);
    if (!(await this.sessionStore.vendorExists(vendorId))) throw new NotFoundException(wmBody('ACT_ON_BEHALF_VENDOR_NOT_FOUND', 'That vendor does not exist.'));
  }

  private async mayChange(w: StaffWrite, vendorId: string): Promise<void> {
    await this.mayEdit(w.staff, vendorId);   // first, so a telecaller learns nothing about a business that is not theirs
    if (!w.sessionId) throw new ForbiddenException(wmBody('ACT_ON_BEHALF_REQUIRED', 'Start a session with a reason before you change the website of a business.'));
  }

  async draft(staff: StaffRef, vendorId: string): Promise<DraftView> { await this.mayEdit(staff, vendorId); return this.web.draft(vendorId); }

  async editor(staff: StaffRef, vendorId: string): Promise<EditorView> { await this.mayEdit(staff, vendorId); return this.web.editor(vendorId); }

  /**
   * E11b: the items of a business (hidden ones too), a page at a time, and every item page already written in the draft, so staff can find one and edit it
   * through PUT draft/list/itemDetails. Read only: the same role rule as reading the draft, no session needed.
   */
  async items(staff: StaffRef, vendorId: string, page: { skip: number; take: number; page: number; pageSize: number }): Promise<StaffItemList> {
    await this.mayEdit(staff, vendorId);
    const [rows, total, draft] = await Promise.all([
      this.prisma.vendorProduct.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: page.skip, take: page.take, select: { id: true, name: true, category: true, price: true, active: true } }),
      this.prisma.vendorProduct.count({ where: { vendorId } }),
      this.web.draft(vendorId),
    ]);
    const pages = draft.doc.lists.itemDetails ?? [];
    const pageIds = pages.map((p) => String(p.itemId));
    // the vendor id stays in the filter: an id written into the draft can never show another business's item
    const named = pageIds.length ? await this.prisma.vendorProduct.findMany({ where: { vendorId, id: { in: pageIds } }, select: { id: true, name: true, active: true } }) : [];
    const byId = new Map(named.map((n) => [n.id, n]));
    const written = new Set(pageIds);
    return {
      items: rows.map((r) => ({ itemId: r.id, name: r.name, category: r.category, price: r.price, active: r.active, hasPage: written.has(r.id) })),
      total, page: page.page, pageSize: page.pageSize,
      itemPages: pages.map((p) => { const it = byId.get(String(p.itemId)); return { itemId: String(p.itemId), title: String(p.title ?? ''), status: String(p.status ?? ''), area: String(p.area ?? ''), itemName: it?.name ?? null, itemActive: it?.active ?? false }; }),
    };
  }

  async save(w: StaffWrite, vendorId: string, change: Change): Promise<DraftView> { await this.mayChange(w, vendorId); return this.web.save(vendorId, w.actor, change); }

  /** The profile details (opening hours, owner name and the rest), checked against the category of the business exactly as when the owner saves them. */
  async saveProfile(w: StaffWrite, vendorId: string, values: unknown): Promise<SaveResult> { await this.mayChange(w, vendorId); return this.profile.save(vendorId, w.actor, values); }
}
