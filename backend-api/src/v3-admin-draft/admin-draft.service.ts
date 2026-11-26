import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { ProfileFieldsService, SaveResult } from '../v3-profile-fields/profile.service';
import { ActOnBehalfService, StaffRef } from '../v3-website/act-on-behalf/act-on-behalf.service';
import { ActOnBehalfStore } from '../v3-website/act-on-behalf/act-on-behalf.store';
import { wmBody } from '../v3-website/website.errors';
import { Change, DraftView, EditorView, WebsiteService } from '../v3-website/website.service';

/** One staff request: who is asking, the actor for the records, and the act-on-behalf session it ran in (set by the interceptor once it has checked the header; null without one). */
export interface StaffWrite { staff: StaffRef; actor: Actor; sessionId: string | null }

/**
 * E9a: staff edit a business's website draft. Every change goes through the same service as the owner's own edit, so the field rules, the plan limits and the wording check are identical.
 * Two rules come on top: the role rule (SALES only as the telecaller who created the business) and, for a change, a live act-on-behalf session. The session holds the written reason and tells the
 * owner; the activity row of the request names the staff member and the session. Together they record who changed what, and why.
 */
@Injectable()
export class AdminDraftService {
  constructor(private readonly web: WebsiteService, private readonly sessions: ActOnBehalfService, private readonly sessionStore: ActOnBehalfStore, private readonly profile: ProfileFieldsService) {}

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

  async save(w: StaffWrite, vendorId: string, change: Change): Promise<DraftView> { await this.mayChange(w, vendorId); return this.web.save(vendorId, w.actor, change); }

  /** The profile details (opening hours, owner name and the rest), checked against the category of the business exactly as when the owner saves them. */
  async saveProfile(w: StaffWrite, vendorId: string, values: unknown): Promise<SaveResult> { await this.mayChange(w, vendorId); return this.profile.save(vendorId, w.actor, values); }
}
