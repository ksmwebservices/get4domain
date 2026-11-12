import { ExpenseFields, ItemFields, SaleFields } from './core/accounts-core';

export interface SaleRow extends SaleFields { id: string; vendorId: string; createdAt: Date }
export interface ExpenseRow extends ExpenseFields { id: string; vendorId: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface ItemRow extends ItemFields { id: string; vendorId: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface RangeQuery { from?: Date; to?: Date }
export interface Paging { skip: number; take: number }
/** The most rows one summary reads; a period with more says so (`truncated`) instead of quietly adding up part of it. */
export const SUMMARY_ROW_CAP = 5000;

/**
 * Everything the accounts module stores, behind one port (Prisma implementation and an in-memory twin). Every read and write carries the vendor id in its WHERE. `postSale` is idempotent:
 * the database refuses a second record for the same source, so the same document posted twice (or in parallel) gives one sale record and `created: false`.
 */
export abstract class AccountsStore {
  abstract postSale(vendorId: string, s: SaleFields): Promise<{ row: SaleRow; created: boolean }>;
  abstract listSales(vendorId: string, r: RangeQuery, p: Paging): Promise<{ items: SaleRow[]; total: number }>;
  abstract salesInRange(vendorId: string, r: Required<RangeQuery>): Promise<{ items: SaleRow[]; truncated: boolean }>;
  abstract addExpense(vendorId: string, e: ExpenseFields): Promise<ExpenseRow>;
  abstract listExpenses(vendorId: string, r: RangeQuery & { includeArchived: boolean }, p: Paging): Promise<{ items: ExpenseRow[]; total: number }>;
  abstract getExpense(vendorId: string, id: string): Promise<ExpenseRow | null>;
  abstract updateExpense(vendorId: string, id: string, e: Partial<ExpenseFields> & { archivedAt?: Date | null }): Promise<ExpenseRow | null>;
  /** Live (not archived) expenses whose day falls between two YYYY-MM-DD days, both included. */
  abstract expensesInDays(vendorId: string, fromDay: string, toDay: string): Promise<{ items: ExpenseRow[]; truncated: boolean }>;
  abstract addItem(vendorId: string, i: ItemFields): Promise<ItemRow>;
  abstract listItems(vendorId: string, q: { kind?: string; q?: string; includeArchived: boolean }, p: Paging): Promise<{ items: ItemRow[]; total: number }>;
  abstract getItem(vendorId: string, id: string): Promise<ItemRow | null>;
  abstract updateItem(vendorId: string, id: string, i: Partial<ItemFields> & { archivedAt?: Date | null }): Promise<ItemRow | null>;
  /** The rates that staff have set in the rate table and that are in force now. Empty until staff set some. */
  abstract activeTaxRates(at: Date): Promise<number[]>;
}
