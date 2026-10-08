import { rupees } from './pricing-math';

/** Invoice statuses that still expect money (nothing paid in full, not voided/expired). */
export const OPEN_INVOICE_STATUSES = ['DRAFT', 'SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'] as const;

export interface GuardInvoice { id: string; invoiceNumber: string; status: string; totalAmount: number }
export interface GuardTerm { id: string; status: string; activationInvoiceId: string | null }

export interface ActivationConflict {
  code: 'OPEN_ACTIVATION' | 'UNPAID_TERM';
  message: string;
  details: { invoiceId?: string; invoiceNumber?: string; invoiceStatus?: string; totalAmount?: number; termId?: string; termStatus?: string };
}

/**
 * The Deal builder must not hand a vendor a SECOND way to pay for the same thing: a vendor that already has an open ACTIVATION invoice
 * (or a current term still waiting for its payment) gets a clear refusal pointing at that invoice. Pure so it can be tested without a database.
 * `openActivationInvoices` = this vendor's ACTIVATION invoices whose status is in OPEN_INVOICE_STATUSES, newest first.
 */
export function findActivationConflict(openActivationInvoices: GuardInvoice[], currentTerm: GuardTerm | null): ActivationConflict | null {
  const inv = openActivationInvoices[0];
  if (inv) {
    const more = openActivationInvoices.length > 1 ? ` (and ${openActivationInvoices.length - 1} more)` : '';
    return {
      code: 'OPEN_ACTIVATION',
      message: `This vendor already has an open activation invoice ${inv.invoiceNumber} (${rupees(inv.totalAmount)}, ${inv.status})${more}. Pay or void it first in Admin → Commerce → Invoices, or confirm below with a typed reason.`,
      details: { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, invoiceStatus: inv.status, totalAmount: inv.totalAmount, termId: currentTerm?.id, termStatus: currentTerm?.status },
    };
  }
  if (currentTerm && currentTerm.status === 'ACTIVE_PAYMENT_DUE') {
    return {
      code: 'UNPAID_TERM',
      message: 'This vendor already has an active billing term that is still waiting for its payment. Settle or change that term (Admin → Customers → Billing terms) first, or confirm below with a typed reason.',
      details: { termId: currentTerm.id, termStatus: currentTerm.status, invoiceId: currentTerm.activationInvoiceId ?? undefined },
    };
  }
  return null;
}

/** An override must be a real sentence, not a click-through. */
export function validOverrideReason(reason: string | undefined | null): boolean {
  return (reason ?? '').trim().length >= 10;
}
