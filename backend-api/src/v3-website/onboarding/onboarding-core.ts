/**
 * The onboarding queue (slice 5.13b), pure. A read model over rows that already exist: seeded sites waiting to be claimed, claim links waiting to be used, and new vendors with nothing published.
 * A vendor appears once, as its most advanced kind (a waiting claim link beats a seeded site, which beats a plain new vendor). The oldest wait is first.
 */
export type QueueKind = 'SEEDED' | 'CLAIM' | 'NEW_VENDOR';
export interface QueueItem { kind: QueueKind; vendorId: string; businessName: string; state: string; since: Date; detail: Record<string, unknown> }
export const QUEUE_KINDS: readonly QueueKind[] = ['SEEDED', 'CLAIM', 'NEW_VENDOR'];
const RANK: Readonly<Record<QueueKind, number>> = { CLAIM: 3, SEEDED: 2, NEW_VENDOR: 1 };

export interface MergedQueue { items: QueueItem[]; page: number; pageSize: number; total: number; counts: Record<QueueKind, number> }

export function mergeQueue(all: readonly QueueItem[], page: number, pageSize: number, kind?: QueueKind): MergedQueue {
  const best = new Map<string, QueueItem>();
  for (const i of all) { const cur = best.get(i.vendorId); if (!cur || RANK[i.kind] > RANK[cur.kind]) best.set(i.vendorId, i); }
  const unique = [...best.values()];
  const counts: Record<QueueKind, number> = { SEEDED: 0, CLAIM: 0, NEW_VENDOR: 0 };
  for (const i of unique) counts[i.kind]++;
  const shown = unique.filter((i) => !kind || i.kind === kind).sort((a, b) => a.since.getTime() - b.since.getTime() || (a.vendorId < b.vendorId ? -1 : 1));
  return { items: shown.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: shown.length, counts };
}
