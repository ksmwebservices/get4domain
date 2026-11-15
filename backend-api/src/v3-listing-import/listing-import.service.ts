import { HttpException, Injectable, Optional } from '@nestjs/common';
import { SUPER_ONLY } from '../auth/guards/admin-role-matrix';
import { ActivityService } from '../v3-activity/activity.service';
import { SeededSitesService, StaffRole } from '../seeded-sites/seeded-sites.service';
import { Actor } from '../plans/admin/audit.service';
import { ProfileFieldsService } from '../v3-profile-fields/profile.service';
import { importKeyOf, ImportRow, parseImport, parseServices, PINCODE, profileCell, templateColumns } from './core/import-core';
import { importError } from './listing-import.errors';

export interface Who { actor: Actor; role: StaffRole }
export type LineStatus = 'WILL_CREATE' | 'CREATED' | 'SKIPPED' | 'FAILED';
export interface ImportLine { line: number; businessName: string; status: LineStatus; importKey: string; reasons: string[]; listingId?: string }
export interface ImportReport { mode: 'DRY_RUN' | 'APPLY'; applied: boolean; blocked: boolean; ignoredColumns: string[]; counts: { total: number; wouldCreate: number; created: number; skipped: number; failed: number }; lines: ImportLine[] }

const reasonsOf = (e: unknown): string[] => {
  if (e instanceof HttpException) {
    const b = e.getResponse() as { code?: string; message?: string; details?: { fields?: Record<string, string> }; errors?: string[] };
    if (b.details?.fields) return Object.entries(b.details.fields).map(([k, v]) => `${k}: ${v}`);
    if (Array.isArray(b.errors)) return b.errors.map(String);
    return [b.message ?? b.code ?? 'The row could not be used.'];
  }
  return ['The row could not be used.'];
};

/**
 * The listing import (Wave 2 Part D). A DRY RUN is the default: every row is judged exactly as a seeded-site batch judges it (public facts and the staff tick, the category, duplicates, the do-not-contact register) and
 * against the category's profile fields, and nothing is created. An APPLY runs the same judgement first and is REFUSED if even one row is bad, so a file is all good or nothing is made. The rows that are already listed
 * (the same phone or email, the same business name and pincode) are skipped, so applying the same file twice makes nothing twice. A row creates the listing and its draft site on behalf, then its profile.
 */
@Injectable()
export class ListingImportService {
  constructor(private readonly seeded: SeededSitesService, private readonly profiles: ProfileFieldsService, @Optional() private readonly activity?: ActivityService) {}

  /** The columns of the template, for one category (or the base columns when none is named). */
  async template(category?: string): Promise<{ category: string | null; columns: string[]; header: string; note: string }> {
    const fields = category ? (await this.profiles.schemaFor(category)).fields.map((f) => ({ fieldKey: f.key, type: f.type as never })) : [];
    const t = templateColumns(fields);
    return { category: category ?? null, columns: t.columns, header: t.header, note: 'Separate several services or list items with a semicolon. A service can have a short description after a colon. Pictures are added after the import.' };
  }

  private async judge(csv: string, who: Who): Promise<{ lines: ImportLine[]; ignored: string[]; ready: Array<{ row: ImportRow; values: Record<string, unknown> }> }> {
    const all = await this.profiles.listAll();
    const keys = new Set(all.fields.map((f) => f.fieldKey));
    const parsed = parseImport(csv, await this.seeded.importMaxRows(), keys);
    if (parsed.error) throw importError('IMPORT_INVALID', parsed.error);
    const classes = await this.seeded.classify(parsed.rows.map((r) => ({ line: r.line, cells: { ...r.cells, businessName: r.cells.businessName ?? '', category: r.cells.category ?? '' } })), SUPER_ONLY.includes(who.role));
    const byLine = new Map(classes.map((c) => [c.line, c] as const));
    const lines: ImportLine[] = []; const ready: Array<{ row: ImportRow; values: Record<string, unknown> }> = [];
    for (const row of parsed.rows) {
      const c = byLine.get(row.line)!; const reasons: string[] = [];
      const businessName = c.input?.businessName ?? row.cells.businessName ?? '';
      const importKey = importKeyOf({ phone: c.input?.phone ?? row.cells.phone, email: c.input?.email ?? row.cells.email, businessName, pincode: row.pincode });
      if (c.status === 'REJECTED') reasons.push(...(c.errors ?? ['The row is not valid.']));
      if (c.status === 'ON_REGISTER' || c.status === 'REMOVED_BEFORE') reasons.push(...(c.errors ?? ['This business asked not to be listed.']));
      if (!PINCODE.test(row.pincode)) reasons.push('pincode: six digits, not starting with 0');
      if (row.state.length > 60 || /[<>]/.test(row.state)) reasons.push('state: up to 60 characters of plain text');
      const sv = parseServices(row.services); if (!sv.ok) reasons.push(sv.error);
      const inFile = (c.duplicates ?? []).filter((d) => d.line !== undefined);
      if (inFile.length) reasons.push(`repeated in this file (line ${inFile.map((d) => d.line).join(', ')})`);
      const skip = c.status === 'DUPLICATE' && inFile.length === 0;
      let values: Record<string, unknown> = {};
      if (reasons.length === 0 && !skip && c.input) {
        values = { business_name: c.input.businessName, locality: c.input.area, city: c.input.city, pincode: row.pincode, phone: c.input.phone, ...(c.input.address ? { address_line: c.input.address } : {}), ...(c.input.email ? { email: c.input.email } : {}), ...(row.state ? { state: row.state } : {}), ...(sv.ok && sv.value.length ? { services: sv.value } : {}) };
        const cat = await this.profiles.schemaFor(c.input.category).catch(() => null);
        for (const [k, cell] of Object.entries(row.profile)) {
          const f = cat?.fields.find((x) => x.key === k);
          if (!f) { reasons.push(`${k}: not a field of this category`); continue; }
          const pc = profileCell({ type: f.type as never }, cell); if (pc.ok) values[k] = pc.value; else reasons.push(`${k}: ${pc.error}`);
        }
        if (reasons.length === 0) { try { values = await this.profiles.validateForCategory(c.input.category, values); } catch (e) { reasons.push(...reasonsOf(e)); } }
      }
      const status: LineStatus = reasons.length ? 'FAILED' : skip ? 'SKIPPED' : 'WILL_CREATE';
      if (skip) reasons.push('Already listed, or removed before (the same phone, email or name in the same city): skipped.');
      lines.push({ line: row.line, businessName, status, importKey, reasons });
      if (status === 'WILL_CREATE') ready.push({ row, values });
    }
    return { lines, ignored: parsed.ignored, ready };
  }

  private report(mode: ImportReport['mode'], applied: boolean, lines: ImportLine[], ignored: string[]): ImportReport {
    const n = (s: LineStatus): number => lines.filter((l) => l.status === s).length;
    return { mode, applied, blocked: n('FAILED') > 0, ignoredColumns: ignored, counts: { total: lines.length, wouldCreate: n('WILL_CREATE'), created: n('CREATED'), skipped: n('SKIPPED'), failed: n('FAILED') }, lines };
  }

  async dryRun(csv: string, who: Who): Promise<ImportReport> {
    const j = await this.judge(csv, who);
    return this.report('DRY_RUN', false, j.lines, j.ignored);
  }

  async apply(csv: string, who: Who): Promise<ImportReport> {
    const j = await this.judge(csv, who);
    if (j.lines.some((l) => l.status === 'FAILED')) throw importError('IMPORT_BLOCKED', 'Some rows need fixing, so nothing was created. Fix them and import the file again.', { report: this.report('DRY_RUN', false, j.lines, j.ignored) });
    const byLine = new Map(j.lines.map((l) => [l.line, l] as const));
    for (const { row, values } of j.ready) {
      const line = byLine.get(row.line)!;
      try {
        const created = await this.seeded.create({ ...row.cells, businessName: row.cells.businessName ?? '', category: row.cells.category ?? '' }, who);
        line.listingId = String((created as { id?: string }).id ?? '');
        await this.profiles.saveForListing(line.listingId, who.actor, values);
        line.status = 'CREATED';
      } catch (e) { line.status = 'FAILED'; line.reasons = reasonsOf(e); }   // the rows made so far stay; applying the same file again skips them and retries this one
    }
    const rep = this.report('APPLY', true, j.lines, j.ignored);
    await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: who.actor.id, ip: who.actor.ip ?? null }, actionKey: 'listing.import_applied', entityType: 'listing_import', entityId: null, summary: rep.counts });
    return rep;
  }
}
