/**
 * The plan order state machine (slice 5.1b). Pure.
 * PAID is only reachable from PENDING_PAYMENT (the provider took the right amount) or REVIEW (staff resolved a disagreement). A failed payment ATTEMPT does not end an order
 * (the provider order stays payable until it expires), so there is no PENDING_PAYMENT -> FAILED edge: FAILED means the provider order could not be created.
 */
export type OrderStatus = 'CREATED' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REVIEW';

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['PENDING_PAYMENT', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PENDING_PAYMENT: ['PAID', 'EXPIRED', 'CANCELLED', 'REVIEW'],
  REVIEW: ['PAID', 'CANCELLED'],
  PAID: [], FAILED: [],
  EXPIRED: ['REVIEW'], CANCELLED: ['REVIEW'],   // a payment that arrives for a closed order is money without a purchase: staff decide, nothing activates by itself
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean { return (NEXT[from] ?? []).includes(to); }
/** Final states: nothing can happen to the order any more. */
export function isTerminalOrder(s: OrderStatus): boolean { return (NEXT[s] ?? []).length === 0; }
