// Plan capabilities beyond menu screens (Full BOS, 2026-10-09). The ONE place that says which plan switches what on.
// Starting default split for KSM (editable in admin > Plan access, stored in g4d_plan_overrides; never hard-code a plan check in business code).
import type { Capability } from './types';

export const CAPABILITIES: Capability[] = [
  { id: 'bos.purchases', label: 'Purchases, suppliers and payables', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'Record what you buy', body: 'Purchase bills, suppliers, what you owe, and the GST you can claim back. Pro keeps your stock cost up to date from your purchases.' } },
  { id: 'bos.multi-location', label: 'More than one stock location, transfers', minPlan: 'BOS', capture: 'gated',
    limits: { locations: { WORKSPACE: 1, BOS: 10 } },
    upgrade: { headline: 'Stock in more than one place', body: 'Keep a shop, a godown and more as separate stock locations and move stock between them. Your existing stock stays as it is.' } },
  { id: 'bos.stock-valuation', label: 'Stock valuation', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'See what your stock is worth', body: 'Stock value at cost for every item and in total. The cost comes from the purchases and prices you already entered.' } },
  { id: 'bos.books', label: 'Ledger, day book, trial balance, profit and loss, balance sheet', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'Your full books', body: 'Ledger, day book, trial balance, profit and loss and balance sheet, built from the invoices, payments and expenses you have already recorded, including everything from before you upgraded.' } },
  { id: 'bos.gst-reports', label: 'GST summary and HSN summary', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'GST returns made simple', body: 'GSTR-1 and GSTR-3B style summaries and the HSN summary, ready to hand to your accountant, from the bills you have already made.' } },
  { id: 'bos.ca-pack', label: 'CA pack export', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'One file for your CA', body: 'All registers in one Excel workbook with a summary page, for any month, quarter or year.' } },
  { id: 'bos.period-lock', label: 'Period lock', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'Lock a closed month', body: 'Once your CA has the month, lock it so nothing in it can change by mistake.' } },
  { id: 'bos.recurring', label: 'Recurring invoices and scheduled payment reminders', minPlan: 'BOS', capture: 'gated',
    upgrade: { headline: 'Bill the same customer every month', body: 'Set an invoice to repeat monthly, quarterly or yearly, and get a reminder list of who is overdue.' } },
  { id: 'bos.staff', label: 'Extra staff users and roles', minPlan: 'WORKSPACE', capture: 'gated',
    limits: { seats: { WORKSPACE: 1, BOS: 5 } },
    upgrade: { headline: 'Add your team', body: 'Invite more people with their own access. Your plan includes a number of seats; Pro includes more.' } },
];
