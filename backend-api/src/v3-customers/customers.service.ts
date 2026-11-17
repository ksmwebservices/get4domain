import { Injectable } from '@nestjs/common';
import { checkCustomerInput, cleanTags, ConsentState, CustomerSource, isConsentState, isCustomerSource, nextConsent } from './core/customer-core';
import { customerError } from './customers.errors';
import { CustomerKeyTaken, CustomerRow, CustomersStore, SourceRow } from './customers.store';

/** Rows one import call may carry. */
export const IMPORT_MAX_ROWS = 500;
export interface CaptureInput { name: string; phone?: string | null; email?: string | null; source: CustomerSource; refType?: string; refId?: string }
export interface CaptureResult { customer: CustomerRow; created: boolean; sourceAdded: boolean }
export interface CustomerPatchInput { name?: string; phone?: string | null; email?: string | null; notes?: string | null; tags?: string[]; consent?: ConsentState }
export interface ListInput { q?: string; source?: string; includeArchived?: boolean; skip: number; take: number }

const view = (r: CustomerRow) => ({
  id: r.id, name: r.name, phone: r.phone, email: r.email, firstSource: r.firstSource, consent: r.consent, consentAt: r.consentAt, notes: r.notes, tags: r.tags, archived: r.archivedAt !== null, createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const sourceView = (s: SourceRow) => ({ source: s.source, refType: s.refType, refId: s.refId, at: s.at });

/**
 * The one customer list of a business (slice 5.23a). Other modules put people on it through `capture`; the vendor's own screens use the rest. A person is one row: a second capture of the same phone
 * or e-mail adds a source, never a customer. Nothing is deleted (archive and restore), and a new customer's consent is UNKNOWN until someone says otherwise.
 * The plan gate is the route's `@RequiresFeature('crm.customers')`; `capture` is called by our own modules and never reads another table of the old product.
 */
@Injectable()
export class CustomersService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: CustomersStore) {}

  /** The one entry point for every module that meets a customer. Safe to call again with the same reference. */
  async capture(vendorId: string, i: CaptureInput): Promise<CaptureResult> {
    if (!isCustomerSource(i.source)) throw customerError(400, 'CUSTOMER_INVALID', 'That source is not known.', { problem: 'source' });
    const c = checkCustomerInput(i);
    if (!c.ok) throw customerError(400, 'CUSTOMER_INVALID', c.problems.join('; '));
    const found = await this.store.findByKeys(vendorId, c.value.phoneKey, c.value.emailKey);
    let row = found; let created = false;
    if (!row) { const r = await this.store.create(vendorId, { ...c.value, firstSource: i.source }); row = r.row; created = r.created; }
    else if ((!row.phoneKey && c.value.phoneKey) || (!row.emailKey && c.value.emailKey)) {
      // the same person gave a way to reach them that we did not have yet: fill the gap, never overwrite what is there
      try { row = (await this.store.update(vendorId, row.id, { ...(!row.phoneKey && c.value.phoneKey ? { phone: c.value.phone, phoneKey: c.value.phoneKey } : {}), ...(!row.emailKey && c.value.emailKey ? { email: c.value.email, emailKey: c.value.emailKey } : {}) })) ?? row; } catch (e) { if (!(e instanceof CustomerKeyTaken)) throw e; }
    }
    const sourceAdded = await this.store.addSource(vendorId, row.id, { source: i.source, refType: (i.refType ?? '').slice(0, 40), refId: (i.refId ?? '').slice(0, 80), at: this.clock() });
    return { customer: row, created, sourceAdded };
  }

  async list(vendorId: string, q: ListInput) {
    if (q.source !== undefined && !isCustomerSource(q.source)) throw customerError(400, 'CUSTOMER_INVALID', 'That source is not known.', { problem: 'source' });
    const r = await this.store.list(vendorId, { q: q.q?.slice(0, 80), source: q.source as CustomerSource | undefined, includeArchived: q.includeArchived === true, skip: q.skip, take: q.take });
    return { items: r.items.map(view), total: r.total };
  }

  async get(vendorId: string, id: string) {
    const r = await this.store.get(vendorId, id);
    if (!r) throw customerError(404, 'CUSTOMER_NOT_FOUND', 'That customer was not found.');
    return { ...view(r.row), sources: r.sources.map(sourceView) };
  }

  /** The vendor adds a customer by hand. A person who is already on the list is refused with the existing id (so the screen can open it), never duplicated. */
  async create(vendorId: string, input: { name: string; phone?: string; email?: string; notes?: string; tags?: string[] }) {
    const c = checkCustomerInput(input);
    if (!c.ok) throw customerError(400, 'CUSTOMER_INVALID', c.problems.join('; '));
    const tags = input.tags === undefined ? [] : cleanTags(input.tags);
    if (!tags) throw customerError(400, 'CUSTOMER_INVALID', 'tags: up to 20 short labels', { problem: 'tags' });
    const found = await this.store.findByKeys(vendorId, c.value.phoneKey, c.value.emailKey);
    if (found) throw customerError(409, 'CUSTOMER_EXISTS', 'This person is already in your customer list.', { details: { customerId: found.id } });
    const r = await this.capture(vendorId, { name: input.name, phone: input.phone, email: input.email, source: 'MANUAL', refType: 'manual', refId: '' });
    if (!r.created) throw customerError(409, 'CUSTOMER_EXISTS', 'This person is already in your customer list.', { details: { customerId: r.customer.id } });   // a parallel add of the same person
    const patch = { ...(input.notes ? { notes: input.notes.slice(0, 2000) } : {}), ...(tags.length ? { tags } : {}) };
    const row = Object.keys(patch).length ? ((await this.store.update(vendorId, r.customer.id, patch)) ?? r.customer) : r.customer;
    return view(row);
  }

  /**
   * Bring a list in at once (the Import screen). Every row is checked on its own: a bad row is reported with its position and never stops the others; a person already on the list (same phone or e-mail,
   * or the same person twice in the file) is counted as existing, never duplicated; a new person gets the source MANUAL, reference "import", and consent UNKNOWN. Nothing is deleted or overwritten.
   * At most IMPORT_MAX_ROWS rows in one call, so one request cannot hold the database.
   */
  async importRows(vendorId: string, rows: Array<{ name?: unknown; phone?: unknown; email?: unknown; notes?: unknown; tags?: unknown }>) {
    if (!Array.isArray(rows) || rows.length === 0) throw customerError(400, 'CUSTOMER_INVALID', 'Send at least one row.', { problem: 'rows' });
    if (rows.length > IMPORT_MAX_ROWS) throw customerError(400, 'CUSTOMER_IMPORT_TOO_LARGE', `Send at most ${IMPORT_MAX_ROWS} rows at a time.`, { details: { max: IMPORT_MAX_ROWS } });
    const seen = new Set<string>(); const invalid: Array<{ row: number; problems: string[] }> = [];
    let created = 0; let existing = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      const c = checkCustomerInput(r as { name?: unknown; phone?: unknown; email?: unknown });
      if (!c.ok) { invalid.push({ row: i + 1, problems: c.problems }); continue; }
      const tags = r.tags === undefined || r.tags === null || r.tags === '' ? [] : cleanTags(Array.isArray(r.tags) ? r.tags : String(r.tags).split(/[;,]/).map((t) => t.trim()).filter(Boolean));
      if (!tags) { invalid.push({ row: i + 1, problems: ['tags: up to 20 short labels'] }); continue; }
      const keys = [c.value.phoneKey && `p:${c.value.phoneKey}`, c.value.emailKey && `e:${c.value.emailKey}`].filter((k): k is string => !!k);
      if (keys.some((k) => seen.has(k))) { existing += 1; continue; }   // the same person twice in the file
      keys.forEach((k) => seen.add(k));
      const found = await this.store.findByKeys(vendorId, c.value.phoneKey, c.value.emailKey);
      if (found) { existing += 1; continue; }
      const cap = await this.capture(vendorId, { name: String(r.name), phone: r.phone as string | null | undefined, email: r.email as string | null | undefined, source: 'MANUAL', refType: 'import', refId: '' });
      if (!cap.created) { existing += 1; continue; }
      created += 1;
      const patch = { ...(typeof r.notes === 'string' && r.notes.trim() ? { notes: r.notes.slice(0, 2000) } : {}), ...(tags.length ? { tags } : {}) };
      if (Object.keys(patch).length) await this.store.update(vendorId, cap.customer.id, patch);
    }
    return { total: rows.length, created, existing, invalid };
  }

  async update(vendorId: string, id: string, p: CustomerPatchInput) {
    const cur = await this.store.get(vendorId, id);
    if (!cur) throw customerError(404, 'CUSTOMER_NOT_FOUND', 'That customer was not found.');
    const patch: Parameters<CustomersStore['update']>[2] = {};
    if (p.name !== undefined || p.phone !== undefined || p.email !== undefined) {
      const c = checkCustomerInput({ name: p.name ?? cur.row.name, phone: p.phone === undefined ? cur.row.phone : p.phone, email: p.email === undefined ? cur.row.email : p.email });
      if (!c.ok) throw customerError(400, 'CUSTOMER_INVALID', c.problems.join('; '));
      Object.assign(patch, c.value);
    }
    if (p.notes !== undefined) patch.notes = p.notes === null ? null : String(p.notes).slice(0, 2000);
    if (p.tags !== undefined) { const t = cleanTags(p.tags); if (!t) throw customerError(400, 'CUSTOMER_INVALID', 'tags: up to 20 short labels', { problem: 'tags' }); patch.tags = t; }
    if (p.consent !== undefined) {
      if (!isConsentState(p.consent)) throw customerError(400, 'CUSTOMER_INVALID', 'consent: UNKNOWN, OPTED_IN or OPTED_OUT', { problem: 'consent' });
      const next = nextConsent(cur.row.consent, p.consent);
      if (next !== p.consent) throw customerError(409, 'CUSTOMER_CONSENT_LOCKED', 'This customer opted out. Only they can opt in again.');
      if (next !== cur.row.consent) { patch.consent = next; patch.consentAt = this.clock(); }
    }
    try {
      const row = await this.store.update(vendorId, id, patch);
      if (!row) throw customerError(404, 'CUSTOMER_NOT_FOUND', 'That customer was not found.');
      return view(row);
    } catch (e) {
      if (e instanceof CustomerKeyTaken) throw customerError(409, 'CUSTOMER_EXISTS', 'Another customer already has that phone or e-mail.', { details: { customerId: e.customerId } });
      throw e;
    }
  }

  async archive(vendorId: string, id: string, archived: boolean) {
    const row = await this.store.update(vendorId, id, { archivedAt: archived ? this.clock() : null });
    if (!row) throw customerError(404, 'CUSTOMER_NOT_FOUND', 'That customer was not found.');
    return view(row);
  }

  summary(vendorId: string) { return this.store.summary(vendorId); }
}
