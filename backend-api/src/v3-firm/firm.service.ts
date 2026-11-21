import { HttpException, Injectable, Optional } from '@nestjs/common';
import { ActivityService } from '../v3-activity/activity.service';
import { applyFirmTokens, checkFirmEdit, FIRM_DEFAULTS, FirmEdit, FirmProfile, invoiceSeller, publicFirm } from './core/firm-core';
import { FirmStore } from './firm.store';

export const FIRM_CACHE_TTL_MS = 15_000;
export interface FirmActor { id: string | null; ip?: string | null }

/**
 * The platform's own company details (Wave 2 Part H3). Everything that prints them (the invoices, the proposal, the legal text, the public footer) asks here. Read once and kept 15 seconds in process
 * memory, forgotten after every staff write. A missing row (the migration not applied yet) answers the defaults, so a document is never blank. Staff edits are SUPER_ADMIN only and audited.
 */
@Injectable()
export class FirmService {
  private cached: { at: number; v: FirmProfile } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly store: FirmStore, @Optional() private readonly activity?: ActivityService) {}

  invalidate(): void { this.cached = null; }

  async get(): Promise<FirmProfile> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < FIRM_CACHE_TTL_MS) return this.cached.v;
    const v = (await this.store.get()) ?? { ...FIRM_DEFAULTS };
    this.cached = { at: now, v };
    return v;
  }

  /** The public footer data: name, address, and the GSTIN only when it is set. */
  async publicView(): Promise<ReturnType<typeof publicFirm>> { return publicFirm(await this.get()); }
  /** The seller block of an invoice or a proposal (an unset field is an empty text that every renderer leaves out). */
  async seller(): Promise<ReturnType<typeof invoiceSeller>> { return invoiceSeller(await this.get()); }
  /** A legal text with its {{firm.*}} tokens filled in; a line whose token has no value is dropped. */
  async fillTokens(text: string): Promise<string> { return applyFirmTokens(text, await this.get()); }

  async update(input: FirmEdit, actor: FirmActor): Promise<FirmProfile> {
    const before = (await this.store.get()) ?? { ...FIRM_DEFAULTS };
    const checked = checkFirmEdit(input, before);
    if (!checked.ok) throw new HttpException({ message: 'The firm profile has problems.', code: 'FIRM_PROFILE_INVALID', details: { fields: checked.problems } }, 400);
    const changed = (Object.keys(checked.patch) as Array<keyof FirmProfile>).filter((k) => checked.patch[k] !== before[k]);
    if (changed.length === 0) return before;
    const row = await this.store.update(Object.fromEntries(changed.map((k) => [k, checked.patch[k]])) as Partial<FirmProfile>, actor.id);
    this.invalidate();
    await this.activity?.record({
      vendorId: null, actor: { type: 'STAFF', id: actor.id, ip: actor.ip ?? null }, actionKey: 'firm.profile.changed', entityType: 'FirmProfile', entityId: 'platform',
      summary: { fields: changed, before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, row[k]])) },
    });
    return row;
  }
}
