import { CAPABILITIES, DEPARTMENTS, FEATURES, type Feature, type MinPlan } from '@/lib/nav.generated';

/**
 * The vendor-facing list of what a plan includes (Bug B4). It is GENERATED from the feature registry, never typed by hand, so it can only say what the
 * product does today:
 *   built and verified (WORKING / LIMITED)   -> listed as included
 *   not built or not verified yet            -> listed as "Coming soon" (never as a promise of a date)
 *   anything else (hidden, not in the plan)  -> not listed
 * The marketing site keeps its own copy in data/platform-features.ts; this file feeds the dashboard (Plan and billing, go live).
 */
export interface PlanLine { id: string; label: string; group: string; state: 'INCLUDED' | 'COMING_SOON'; note?: string }

const RANK: Record<MinPlan, number> = { WORKSPACE: 1, BOS: 2, CUSTOM: 3 };
const built = (f: Feature): boolean => f.status === 'WORKING' || f.status === 'LIMITED';
const groupOf = (f: Feature): string => DEPARTMENTS.find((d) => d.id === f.department)?.label ?? f.department;

/** Every line of a plan, in menu order. A feature in a lower plan is part of the higher plan too. */
export function planFeatureLines(plan: 'WORKSPACE' | 'BOS'): PlanLine[] {
  const lines: PlanLine[] = [];
  for (const f of FEATURES) {
    if (f.department === 'custom' || f.hidden || f.id === 'home.today') continue;
    if (RANK[f.minPlan] > RANK[plan]) continue;
    lines.push({ id: f.id, label: f.label, group: groupOf(f), state: built(f) ? 'INCLUDED' : 'COMING_SOON', note: built(f) ? undefined : undefined });
  }
  for (const c of CAPABILITIES) {
    if (RANK[c.minPlan] > RANK[plan]) continue;
    lines.push({ id: c.id, label: c.label, group: 'Business tools', state: 'INCLUDED' });
  }
  return lines;
}

/** What Pro adds over Essentials: the lines of the higher plan that the lower plan does not have. */
export function planGains(from: 'WORKSPACE', to: 'BOS'): PlanLine[] {
  const have = new Set(planFeatureLines(from).map((l) => l.id));
  return planFeatureLines(to).filter((l) => !have.has(l.id));
}

export function groupLines(lines: PlanLine[]): { title: string; lines: PlanLine[] }[] {
  const out = new Map<string, PlanLine[]>();
  for (const l of lines) out.set(l.group, [...(out.get(l.group) ?? []), l]);
  return [...out.entries()].map(([title, ls]) => ({ title, lines: ls }));
}
