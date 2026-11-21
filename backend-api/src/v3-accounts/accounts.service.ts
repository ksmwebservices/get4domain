import { Injectable } from '@nestjs/common';
import { accountsError } from './accounts.errors';
import { AccountsStore, ExpenseRow, ItemRow, SaleRow } from './accounts.store';
import { checkExpense, checkItem, DocumentInput, gstSummary, parseRange, saleFromDocument, TaxProfileInput } from './core/accounts-core';

/** Where the accounts module reads the vendor's own documents (slice 5.17d) and tax profile. The module wires it to the payments module; tests use a fake. Read only. */
export abstract class DocumentSource {
  abstract listIssued(vendorId: string, skip: number, take: number): Promise<{ items: DocumentInput[]; total: number }>;
  abstract taxProfile(vendorId: string): Promise<TaxProfileInput>;
}

export interface ExpenseInput { date?: unknown; category?: unknown; description?: unknown; amountPaise?: unknown; gstPaise?: unknown }
export interface ItemInput { kind?: unknown; name?: unknown; hsnSac?: unknown; unit?: unknown; pricePaise?: unknown; taxRatePercent?: unknown }

const SYNC_PAGE = 100;
const SYNC_MAX_PAGES = 200;

const saleView = (s: SaleRow) => ({ id: s.id, number: s.number, kind: s.kind, soldAt: s.soldAt, customerName: s.customerName, taxablePaise: s.taxablePaise, taxPaise: s.taxPaise, cgstPaise: s.cgstPaise, sgstPaise: s.sgstPaise, igstPaise: s.igstPaise, totalPaise: s.totalPaise, documentId: s.sourceId });
const expenseView = (e: ExpenseRow) => ({ id: e.id, date: e.spentOn, category: e.category, description: e.description, amountPaise: e.amountPaise, gstPaise: e.gstPaise, archived: e.archivedAt !== null, createdAt: e.createdAt });
const itemView = (i: ItemRow) => ({ id: i.id, kind: i.kind, name: i.name, hsnSac: i.hsnSac, unit: i.unit, pricePaise: i.pricePaise, taxRatePercent: i.taxRatePercent, archived: i.archivedAt !== null, createdAt: i.createdAt });
const notFound = (what: string) => accountsError(404, 'ACCOUNTS_NOT_FOUND', `That ${what} was not found.`);

/**
 * The accounts module of a business (slice 5.23b): sale records posted from the business's own documents, expenses, items and services, and the GST summary of a period. The plan gate is the
 * route's `@RequiresFeature`. Posting is idempotent (one sale record per document) and runs before every read, so the books are never behind the documents. It reads no legacy billing table.
 */
@Injectable()
export class AccountsService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: AccountsStore, private readonly docs: DocumentSource) {}

  /** Posts every issued document that is not in the books yet. Safe to repeat and to run in parallel. A document whose parts do not add up is skipped and counted. */
  async syncDocuments(vendorId: string): Promise<{ posted: number; alreadyPosted: number; skipped: number }> {
    let posted = 0; let alreadyPosted = 0; let skipped = 0;
    for (let page = 0; page < SYNC_MAX_PAGES; page++) {
      const r = await this.docs.listIssued(vendorId, page * SYNC_PAGE, SYNC_PAGE);
      for (const d of r.items) {
        let fields; try { fields = saleFromDocument(d); } catch { skipped++; continue; }
        const p = await this.store.postSale(vendorId, fields); if (p.created) posted++; else alreadyPosted++;
      }
      if ((page + 1) * SYNC_PAGE >= r.total || r.items.length === 0) break;
    }
    return { posted, alreadyPosted, skipped };
  }

  async listSales(vendorId: string, range: { from?: string; to?: string }, page: number, pageSize: number) {
    await this.syncDocuments(vendorId);
    let from: Date | undefined; let to: Date | undefined;
    if (range.from !== undefined || range.to !== undefined) {
      const r = parseRange(range.from, range.to); if (!r.ok) throw accountsError(400, 'ACCOUNTS_INVALID', 'from and to: two days, YYYY-MM-DD, at most one year apart.');
      from = new Date(r.fromMs); to = new Date(r.toMs);
    }
    const r = await this.store.listSales(vendorId, { from, to }, { skip: (page - 1) * pageSize, take: pageSize });
    return { items: r.items.map(saleView), total: r.total };
  }

  async gstSummary(vendorId: string, fromDay: string, toDay: string) {
    const range = parseRange(fromDay, toDay); if (!range.ok) throw accountsError(400, 'ACCOUNTS_INVALID', 'from and to: two days, YYYY-MM-DD, at most one year apart.');
    await this.syncDocuments(vendorId);
    const [sales, expenses, profile] = await Promise.all([this.store.salesInRange(vendorId, { from: new Date(range.fromMs), to: new Date(range.toMs) }), this.store.expensesInDays(vendorId, fromDay, toDay), this.docs.taxProfile(vendorId)]);
    const s = gstSummary(sales.items, expenses.items, profile);
    return { from: fromDay, to: toDay, ...s, profitPaise: s.salesTotalPaise - s.expenseTotalPaise, truncated: sales.truncated || expenses.truncated };
  }

  // ── expenses ──
  async createExpense(vendorId: string, i: ExpenseInput) {
    const c = checkExpense(i); if (!c.ok) throw accountsError(400, 'ACCOUNTS_INVALID', c.problems.join('; '));
    return expenseView(await this.store.addExpense(vendorId, c.value));
  }
  async listExpenses(vendorId: string, page: number, pageSize: number, includeArchived: boolean) {
    const r = await this.store.listExpenses(vendorId, { includeArchived }, { skip: (page - 1) * pageSize, take: pageSize });
    return { items: r.items.map(expenseView), total: r.total };
  }
  async updateExpense(vendorId: string, id: string, p: ExpenseInput) {
    const cur = await this.store.getExpense(vendorId, id); if (!cur) throw notFound('expense');
    const c = checkExpense({ date: p.date ?? cur.spentOn, category: p.category ?? cur.category, description: p.description ?? cur.description, amountPaise: p.amountPaise ?? cur.amountPaise, gstPaise: p.gstPaise ?? cur.gstPaise });
    if (!c.ok) throw accountsError(400, 'ACCOUNTS_INVALID', c.problems.join('; '));
    const row = await this.store.updateExpense(vendorId, id, c.value); if (!row) throw notFound('expense');
    return expenseView(row);
  }
  async archiveExpense(vendorId: string, id: string, archived: boolean) {
    const row = await this.store.updateExpense(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!row) throw notFound('expense');
    return expenseView(row);
  }

  // ── items and services ──
  async createItem(vendorId: string, i: ItemInput) {
    const c = checkItem(i, await this.store.activeTaxRates(this.clock())); if (!c.ok) throw accountsError(400, 'ACCOUNTS_INVALID', c.problems.join('; '));
    return itemView(await this.store.addItem(vendorId, c.value));
  }
  async listItems(vendorId: string, q: { kind?: string; q?: string; includeArchived?: boolean }, page: number, pageSize: number) {
    const r = await this.store.listItems(vendorId, { kind: q.kind, q: q.q?.slice(0, 80), includeArchived: q.includeArchived === true }, { skip: (page - 1) * pageSize, take: pageSize });
    return { items: r.items.map(itemView), total: r.total };
  }
  async updateItem(vendorId: string, id: string, p: ItemInput) {
    const cur = await this.store.getItem(vendorId, id); if (!cur) throw notFound('item');
    const merged = { kind: p.kind ?? cur.kind, name: p.name ?? cur.name, hsnSac: p.hsnSac === undefined ? cur.hsnSac : p.hsnSac, unit: p.unit === undefined ? cur.unit : p.unit, pricePaise: p.pricePaise === undefined ? cur.pricePaise : p.pricePaise, taxRatePercent: p.taxRatePercent === undefined ? cur.taxRatePercent : p.taxRatePercent };
    const c = checkItem(merged, await this.store.activeTaxRates(this.clock())); if (!c.ok) throw accountsError(400, 'ACCOUNTS_INVALID', c.problems.join('; '));
    const row = await this.store.updateItem(vendorId, id, c.value); if (!row) throw notFound('item');
    return itemView(row);
  }
  async archiveItem(vendorId: string, id: string, archived: boolean) {
    const row = await this.store.updateItem(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!row) throw notFound('item');
    return itemView(row);
  }
}
