import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsStore, ExpenseRow, ItemRow, Paging, RangeQuery, SaleRow, SUMMARY_ROW_CAP } from './accounts.store';
import { ExpenseCategory, ExpenseFields, ItemFields, ItemKind, SaleFields } from './core/accounts-core';

const sale = (r: Prisma.V3SaleRecordGetPayload<Record<string, never>>): SaleRow => ({ id: r.id, vendorId: r.vendorId, sourceType: 'VENDOR_DOCUMENT', sourceId: r.sourceId, number: r.number, kind: r.kind as SaleRow['kind'], soldAt: r.soldAt, customerName: r.customerName, taxablePaise: r.taxablePaise, taxPaise: r.taxPaise, cgstPaise: r.cgstPaise, sgstPaise: r.sgstPaise, igstPaise: r.igstPaise, totalPaise: r.totalPaise, createdAt: r.createdAt });
const expense = (r: Prisma.V3ExpenseGetPayload<Record<string, never>>): ExpenseRow => ({ id: r.id, vendorId: r.vendorId, spentOn: r.spentOn, category: r.category as ExpenseCategory, description: r.description, amountPaise: r.amountPaise, gstPaise: r.gstPaise, archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const item = (r: Prisma.V3ItemGetPayload<Record<string, never>>): ItemRow => ({ id: r.id, vendorId: r.vendorId, kind: r.kind as ItemKind, name: r.name, hsnSac: r.hsnSac, unit: r.unit, pricePaise: r.pricePaise, taxRatePercent: r.taxRatePercent === null ? null : Number(r.taxRatePercent), archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const pick = <T extends object>(o: T, keys: readonly (keyof T)[]): Partial<T> => { const out: Partial<T> = {}; for (const k of keys) if (o[k] !== undefined) out[k] = o[k]; return out; };

@Injectable()
export class PrismaAccountsStore extends AccountsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async postSale(vendorId: string, s: SaleFields): Promise<{ row: SaleRow; created: boolean }> {
    try { return { row: sale(await this.prisma.v3SaleRecord.create({ data: { vendorId, ...s } })), created: true }; }
    catch (e) {
      if (!isUnique(e)) throw e;
      const r = await this.prisma.v3SaleRecord.findFirst({ where: { vendorId, sourceType: s.sourceType, sourceId: s.sourceId } });
      if (!r) throw e;
      return { row: sale(r), created: false };
    }
  }
  private soldAt(r: RangeQuery): Prisma.DateTimeFilter | undefined { return r.from || r.to ? { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lt: r.to } : {}) } : undefined; }
  async listSales(vendorId: string, r: RangeQuery, p: Paging): Promise<{ items: SaleRow[]; total: number }> {
    const soldAt = this.soldAt(r);
    const [items, total] = await Promise.all([this.prisma.v3SaleRecord.findMany({ where: { vendorId, ...(soldAt ? { soldAt } : {}) }, orderBy: { soldAt: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3SaleRecord.count({ where: { vendorId, ...(soldAt ? { soldAt } : {}) } })]);
    return { items: items.map(sale), total };
  }
  async salesInRange(vendorId: string, r: Required<RangeQuery>): Promise<{ items: SaleRow[]; truncated: boolean }> {
    const rows = await this.prisma.v3SaleRecord.findMany({ where: { vendorId, soldAt: { gte: r.from, lt: r.to } }, orderBy: { soldAt: 'asc' }, take: SUMMARY_ROW_CAP + 1 });
    return { items: rows.slice(0, SUMMARY_ROW_CAP).map(sale), truncated: rows.length > SUMMARY_ROW_CAP };
  }

  async addExpense(vendorId: string, e: ExpenseFields): Promise<ExpenseRow> { return expense(await this.prisma.v3Expense.create({ data: { vendorId, ...e } })); }
  async listExpenses(vendorId: string, r: RangeQuery & { includeArchived: boolean }, p: Paging): Promise<{ items: ExpenseRow[]; total: number }> {
    const day = (d: Date): string => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    const spentOn = r.from || r.to ? { ...(r.from ? { gte: day(r.from) } : {}), ...(r.to ? { lt: day(r.to) } : {}) } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.v3Expense.findMany({ where: { vendorId, ...(r.includeArchived ? {} : { archivedAt: null }), ...(spentOn ? { spentOn } : {}) }, orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }], skip: p.skip, take: p.take }),
      this.prisma.v3Expense.count({ where: { vendorId, ...(r.includeArchived ? {} : { archivedAt: null }), ...(spentOn ? { spentOn } : {}) } }),
    ]);
    return { items: items.map(expense), total };
  }
  async getExpense(vendorId: string, id: string): Promise<ExpenseRow | null> { const r = await this.prisma.v3Expense.findFirst({ where: { id, vendorId } }); return r ? expense(r) : null; }
  async updateExpense(vendorId: string, id: string, e: Partial<ExpenseFields> & { archivedAt?: Date | null }): Promise<ExpenseRow | null> {
    const data = pick(e, ['spentOn', 'category', 'description', 'amountPaise', 'gstPaise', 'archivedAt'] as const);
    const n = await this.prisma.v3Expense.updateMany({ where: { id, vendorId }, data });
    if (n.count === 0) return null;
    return this.getExpense(vendorId, id);
  }
  async expensesInDays(vendorId: string, fromDay: string, toDay: string): Promise<{ items: ExpenseRow[]; truncated: boolean }> {
    const rows = await this.prisma.v3Expense.findMany({ where: { vendorId, archivedAt: null, spentOn: { gte: fromDay, lte: toDay } }, orderBy: { spentOn: 'asc' }, take: SUMMARY_ROW_CAP + 1 });
    return { items: rows.slice(0, SUMMARY_ROW_CAP).map(expense), truncated: rows.length > SUMMARY_ROW_CAP };
  }

  async addItem(vendorId: string, i: ItemFields): Promise<ItemRow> { return item(await this.prisma.v3Item.create({ data: { vendorId, ...i } })); }
  async listItems(vendorId: string, q: { kind?: string; q?: string; includeArchived: boolean }, p: Paging): Promise<{ items: ItemRow[]; total: number }> {
    const rest: Prisma.V3ItemWhereInput = { ...(q.includeArchived ? {} : { archivedAt: null }), ...(q.kind ? { kind: q.kind } : {}), ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3Item.findMany({ where: { vendorId, ...rest }, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }), this.prisma.v3Item.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(item), total };
  }
  async getItem(vendorId: string, id: string): Promise<ItemRow | null> { const r = await this.prisma.v3Item.findFirst({ where: { id, vendorId } }); return r ? item(r) : null; }
  async updateItem(vendorId: string, id: string, i: Partial<ItemFields> & { archivedAt?: Date | null }): Promise<ItemRow | null> {
    const data = pick(i, ['kind', 'name', 'hsnSac', 'unit', 'pricePaise', 'taxRatePercent', 'archivedAt'] as const);
    const n = await this.prisma.v3Item.updateMany({ where: { id, vendorId }, data });
    if (n.count === 0) return null;
    return this.getItem(vendorId, id);
  }
  async activeTaxRates(at: Date): Promise<number[]> {
    const rows = await this.prisma.v3TaxRate.findMany({ where: { active: true, validFrom: { lte: at } } });
    return [...new Set(rows.map((r) => Number(r.ratePercent)))].sort((a, b) => a - b);
  }
}
