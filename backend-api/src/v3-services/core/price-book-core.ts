/**
 * The price book at a glance (Dispatch G1 B2). One pure function turns the plan, service and pack price rows into what the owner needs to see on one screen: for every item, is a price in force,
 * is one scheduled, is one only PROPOSED, or is there none at all. A price that is not in force is PENDING and is never shown as a number by the public routes; here the admin sees the number that
 * waits for approval, because the admin is the one who approves it. No price is ever invented: an item with no row has state PRICE_PENDING and amountPaise null.
 */
export type PriceState = 'IN_FORCE' | 'SCHEDULED' | 'PROPOSED' | 'PRICE_PENDING';
export interface PriceRowIn { id: string; ownerId: string; termMonths?: number; amountPaise: number; taxInclusive: boolean; status: string; effectiveFrom: Date | null; note?: string | null }
export interface PriceLineOut { priceId: string | null; amountPaise: number | null; taxInclusive: boolean | null; effectiveFrom: Date | null; state: PriceState; note: string | null }

export const PLAN_TERMS: readonly number[] = [3, 6, 12];

/** The row that decides an item's state: the newest APPROVED row already started wins (IN_FORCE); else the earliest APPROVED row that starts later (SCHEDULED); else the newest PROPOSED row; else none. RETIRED rows never count. */
export function lineFor(rows: readonly PriceRowIn[], now: Date): PriceLineOut {
  const t = now.getTime();
  const approved = rows.filter((r) => r.status === 'APPROVED');
  const started = approved.filter((r) => r.effectiveFrom !== null && r.effectiveFrom.getTime() <= t).sort((a, b) => b.effectiveFrom!.getTime() - a.effectiveFrom!.getTime())[0];
  if (started) return out(started, 'IN_FORCE');
  const later = approved.filter((r) => r.effectiveFrom !== null && r.effectiveFrom.getTime() > t).sort((a, b) => a.effectiveFrom!.getTime() - b.effectiveFrom!.getTime())[0];
  if (later) return out(later, 'SCHEDULED');
  const proposed = rows.filter((r) => r.status === 'PROPOSED').sort((a, b) => (b.effectiveFrom?.getTime() ?? 0) - (a.effectiveFrom?.getTime() ?? 0))[0];
  if (proposed) return out(proposed, 'PROPOSED');
  return { priceId: null, amountPaise: null, taxInclusive: null, effectiveFrom: null, state: 'PRICE_PENDING', note: null };
}
const out = (r: PriceRowIn, state: PriceState): PriceLineOut => ({ priceId: r.id, amountPaise: r.amountPaise, taxInclusive: r.taxInclusive, effectiveFrom: r.effectiveFrom, state, note: r.note ?? null });

export interface PlanIn { id: string; key: string; track: string; level: string; name: string; status: string }
export interface UnitIn { id: string; key: string; name: string; status: string }
export interface PriceBook {
  generatedAt: Date;
  plans: Array<{ planId: string; key: string; name: string; track: string; status: string; terms: Array<{ termMonths: number } & PriceLineOut> }>;
  services: Array<{ key: string; name: string; status: string } & PriceLineOut>;
  packs: Array<{ key: string; name: string; status: string } & PriceLineOut>;
  /** The fee for a later theme switch is just a service price; it is lifted out so the screen can show it first. */
  themeSwitch: ({ key: 'THEME_SWITCH'; name: string } & PriceLineOut) | null;
  summary: { total: number; inForce: number; scheduled: number; proposed: number; pending: number };
}

/** `withMoney` false (MARKETING) hides every amount; the states stay. Only paid plans are priced (a Free plan has no price row). */
export function shapePriceBook(i: { now: Date; plans: readonly PlanIn[]; planPrices: readonly PriceRowIn[]; services: readonly UnitIn[]; servicePrices: readonly PriceRowIn[]; packs: readonly UnitIn[]; packPrices: readonly PriceRowIn[]; withMoney: boolean }): PriceBook {
  const hide = <T extends PriceLineOut>(l: T): T => (i.withMoney ? l : { ...l, amountPaise: null, taxInclusive: null, note: null });
  const plans = i.plans.filter((p) => p.level === 'PRO').sort((a, b) => a.key.localeCompare(b.key)).map((p) => ({
    planId: p.id, key: p.key, name: p.name, track: p.track, status: p.status,
    terms: PLAN_TERMS.map((termMonths) => ({ termMonths, ...hide(lineFor(i.planPrices.filter((r) => r.ownerId === p.id && r.termMonths === termMonths), i.now)) })),
  }));
  const units = (list: readonly UnitIn[], rows: readonly PriceRowIn[]) => [...list].sort((a, b) => a.key.localeCompare(b.key)).map((u) => ({ key: u.key, name: u.name, status: u.status, ...hide(lineFor(rows.filter((r) => r.ownerId === u.id), i.now)) }));
  const services = units(i.services, i.servicePrices); const packs = units(i.packs, i.packPrices);
  const ts = services.find((s) => s.key === 'THEME_SWITCH');
  const themeSwitch = ts ? { key: 'THEME_SWITCH' as const, name: ts.name, priceId: ts.priceId, amountPaise: ts.amountPaise, taxInclusive: ts.taxInclusive, effectiveFrom: ts.effectiveFrom, state: ts.state, note: ts.note } : null;
  const lines: PriceState[] = [...plans.flatMap((p) => p.terms.map((t) => t.state)), ...services.map((s) => s.state), ...packs.map((p) => p.state)];
  const count = (s: PriceState): number => lines.filter((x) => x === s).length;
  return { generatedAt: i.now, plans, services, packs, themeSwitch, summary: { total: lines.length, inForce: count('IN_FORCE'), scheduled: count('SCHEDULED'), proposed: count('PROPOSED'), pending: count('PRICE_PENDING') } };
}
