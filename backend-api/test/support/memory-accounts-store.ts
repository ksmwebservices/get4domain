import { AccountsStore, ExpenseRow, ItemRow, Paging, RangeQuery, SaleRow, SUMMARY_ROW_CAP } from '../../src/v3-accounts/accounts.store';
import { ExpenseFields, ItemFields, SaleFields } from '../../src/v3-accounts/core/accounts-core';

/** In-memory twin of the accounts store: same vendor scoping, same one-record-per-source rule (checked and written with no await in between, like the unique index). */
export class MemoryAccountsStore extends AccountsStore {
  sales: SaleRow[] = []; expenses: ExpenseRow[] = []; items: ItemRow[] = []; rates: number[] = []; private n = 0;
  private id(p: string): string { return `${p}${++this.n}`; }
  async postSale(vendorId: string, s: SaleFields) {
    const hit = this.sales.find((r) => r.vendorId === vendorId && r.sourceType === s.sourceType && r.sourceId === s.sourceId); if (hit) return { row: { ...hit }, created: false };
    const row: SaleRow = { ...s, id: this.id('s'), vendorId, createdAt: new Date() }; this.sales.push(row); return { row: { ...row }, created: true };
  }
  async listSales(vendorId: string, r: RangeQuery, p: Paging) {
    const all = this.sales.filter((x) => x.vendorId === vendorId && (!r.from || x.soldAt >= r.from) && (!r.to || x.soldAt < r.to)).sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime());
    return { items: all.slice(p.skip, p.skip + p.take), total: all.length };
  }
  async salesInRange(vendorId: string, r: Required<RangeQuery>) {
    const all = this.sales.filter((x) => x.vendorId === vendorId && x.soldAt >= r.from && x.soldAt < r.to); return { items: all.slice(0, SUMMARY_ROW_CAP), truncated: all.length > SUMMARY_ROW_CAP };
  }
  async addExpense(vendorId: string, e: ExpenseFields) { const row: ExpenseRow = { ...e, id: this.id('e'), vendorId, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }; this.expenses.push(row); return { ...row }; }
  async listExpenses(vendorId: string, r: RangeQuery & { includeArchived: boolean }, p: Paging) {
    const all = this.expenses.filter((x) => x.vendorId === vendorId && (r.includeArchived || !x.archivedAt)).sort((a, b) => b.spentOn.localeCompare(a.spentOn)); return { items: all.slice(p.skip, p.skip + p.take), total: all.length };
  }
  async getExpense(vendorId: string, id: string) { const r = this.expenses.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async updateExpense(vendorId: string, id: string, e: Partial<ExpenseFields> & { archivedAt?: Date | null }) {
    const r = this.expenses.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null; Object.assign(r, Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)), { updatedAt: new Date() }); return { ...r };
  }
  async expensesInDays(vendorId: string, fromDay: string, toDay: string) { const all = this.expenses.filter((x) => x.vendorId === vendorId && !x.archivedAt && x.spentOn >= fromDay && x.spentOn <= toDay); return { items: all, truncated: false }; }
  async addItem(vendorId: string, i: ItemFields) { const row: ItemRow = { ...i, id: this.id('i'), vendorId, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }; this.items.push(row); return { ...row }; }
  async listItems(vendorId: string, q: { kind?: string; q?: string; includeArchived: boolean }, p: Paging) {
    const all = this.items.filter((x) => x.vendorId === vendorId && (q.includeArchived || !x.archivedAt) && (!q.kind || x.kind === q.kind) && (!q.q || x.name.toLowerCase().includes(q.q.toLowerCase()))); return { items: all.slice(p.skip, p.skip + p.take), total: all.length };
  }
  async getItem(vendorId: string, id: string) { const r = this.items.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async updateItem(vendorId: string, id: string, i: Partial<ItemFields> & { archivedAt?: Date | null }) {
    const r = this.items.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null; Object.assign(r, Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)), { updatedAt: new Date() }); return { ...r };
  }
  async activeTaxRates() { return [...this.rates]; }
}
