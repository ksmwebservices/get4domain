// Pure helpers for the Orders screen.

export type OrderBucket = 'awaiting' | 'paid' | 'cancelled';

/** Server statuses: PENDING_PAYMENT (order request waiting for the shop to collect), completed (paid), CANCELLED. Anything else counts as paid (legacy online sales). */
export function orderBucket(status: string): OrderBucket {
  const s = (status || '').toUpperCase();
  if (s === 'PENDING_PAYMENT') return 'awaiting';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
  return 'paid';
}

export const ORDER_FILTERS: { key: 'all' | OrderBucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting', label: 'Waiting for payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function orderTotals(orders: { status: string; total: number }[]): Record<OrderBucket, { count: number; amount: number }> {
  const out: Record<OrderBucket, { count: number; amount: number }> = { awaiting: { count: 0, amount: 0 }, paid: { count: 0, amount: 0 }, cancelled: { count: 0, amount: 0 } };
  for (const o of orders) {
    const b = orderBucket(o.status);
    out[b].count += 1;
    if (b !== 'cancelled') out[b].amount += o.total || 0; // cancelled money was never revenue
  }
  return out;
}
