'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '@/lib/api';

/** One thin client for the Full BOS API. Every call unwraps `data`, and every failure becomes a plain sentence that says what to do next. */

export interface PlanRequiredInfo { feature: string; requiredPlan: string }
export class BosError extends Error {
  status: number;
  planRequired: PlanRequiredInfo | null;
  limitReached: boolean;
  constructor(message: string, status: number, planRequired: PlanRequiredInfo | null, limitReached = false) { super(message); this.status = status; this.planRequired = planRequired; this.limitReached = limitReached; }
}

const TECHNICAL = /should not be empty|must be (a|an|one of|longer|shorter|less|greater)|should not exist|must match|must contain|Unexpected token|Failed to fetch|NetworkError|API error|Internal server error|undefined|\[object/i;

/** A raw validation dump or a network error is replaced by a sentence a shop owner can act on. */
export function plain(e: unknown, fallback = 'Something went wrong. Check what you entered and try again.'): string {
  const m = e instanceof Error ? e.message : '';
  if (!m) return fallback;
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'We could not reach the server. Check your internet connection and try again.';
  if (TECHNICAL.test(m)) return fallback;
  return m;
}

export async function bos<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    const r = await apiCall(path, { method: init.method ?? 'GET', ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}) });
    return (r && typeof r === 'object' && 'data' in r ? (r as { data: T }).data : r) as T;
  } catch (e) {
    const err = e as Error & { status?: number; data?: { code?: string; feature?: string; requiredPlan?: string } | null };
    const d = err.data && typeof err.data === 'object' ? err.data : null;
    if (d?.code === 'PLAN_REQUIRED') throw new BosError(err.message, err.status ?? 403, { feature: d.feature ?? '', requiredPlan: d.requiredPlan ?? 'Pro' });
    throw new BosError(plain(err), err.status ?? 0, null, d?.code === 'LIMIT_REACHED');
  }
}

/** Loads on mount and whenever `deps` change; `reload()` after a change. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | null; loading: boolean; error: BosError | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BosError | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loader().then((d) => { if (live) { setData(d); setError(null); } }).catch((e: unknown) => { if (live) setError(e instanceof BosError ? e : new BosError(plain(e), 0, null)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

// ── shapes (money is always integer paise) ──
export interface Entitlements { plan: string; planName: string; custom: boolean; lapsed: boolean; capabilities: Record<string, { id: string; label: string; allowed: boolean; requiredPlan: string; reason: string; limits: Record<string, number | null> }> }
export interface Doc {
  id: string; docType: 'QUOTE' | 'SALES_ORDER' | 'SALES_INVOICE' | 'CREDIT_NOTE' | 'PURCHASE_BILL'; number: string | null; status: string; partyId: string | null; partyName: string | null; partyGstin?: string | null;
  docDate: string; dueDate: string | null; taxKind: 'GST' | 'NONE'; priceMode: 'EXCLUSIVE' | 'INCLUSIVE'; subtotalPaise: number; discountPaise: number; shippingPaise: number; taxablePaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; roundOffPaise: number; totalPaise: number; paidPaise: number; outstandingPaise: number; notes: string | null; terms: string | null; publicToken?: string | null; source?: string | null;
  lines?: DocLine[]; payments?: unknown[]; credits?: { id: string; number: string | null; totalPaise: number }[];
}
export interface DocLine { id: string; itemId: string | null; name: string; description: string | null; variantKey: string | null; hsn: string | null; unit: string | null; qty: number; ratePaise: number; discountPaise: number; gstRate: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
export interface Party { id: string; name: string; phone: string; email: string | null; type: string; gstin: string | null; state: string | null; address?: string | null; owesYouPaise?: number; youOwePaise?: number }
export interface StockRow { id: string; name: string; sku: string | null; unit: string | null; image: string | null; tracked: boolean; onHand: number | null; reorderLevel: number | null; low: boolean; unitCostPaise: number | null; valuePaise: number | null; lastMovementAt?: string | null }

export const rupees = (paise: number | null | undefined, opts: { sign?: boolean } = {}): string => {
  const n = (paise ?? 0) / 100;
  return `${opts.sign && n > 0 ? '+' : n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
};
export const toRupees = (paise: number): number => Math.round(paise) / 100;
export const dateShort = (d: string | Date | null | undefined): string => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', ISSUED: 'Unpaid', PART_PAID: 'Part paid', PAID: 'Paid', CANCELLED: 'Cancelled', ACCEPTED: 'Accepted', REJECTED: 'Rejected', CONVERTED: 'Converted',
};
