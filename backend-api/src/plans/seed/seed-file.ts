import { generatePriceRows, GeneratedPrice } from '../pricing/price-generator';

/**
 * The seed file the OWNER edits (prisma/seed/v3-plans.seed.json) and its pure expansion into table rows. Nothing here names a price, a limit or a state:
 * the file is the only source, and the engine works for any values in it.
 */
export type CellState = 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
export type TrackName = 'handyman' | 'professional' | 'ecommerce';
export interface SeedCell { state: CellState; limit?: number; enum?: string; upsell?: string }
export interface SeedFeature {
  key: string; name: string; group: string; kind: 'BOOLEAN' | 'LIMIT' | 'ENUM'; unit?: string; description?: string; sortOrder?: number;
  free: SeedCell; pro: SeedCell;
  /** per-track replacement of the default cell for one level */
  tracks?: Partial<Record<TrackName, { free?: SeedCell; pro?: SeedCell }>>;
  /** true when the value is a proposal the owner has not confirmed yet */
  proposed?: boolean;
}
export interface SeedPlan { key: string; track: 'HANDYMAN' | 'PROFESSIONAL' | 'ECOMMERCE'; level: 'FREE' | 'PRO'; name: string; description?: string; status: 'DRAFT' | 'ACTIVE' | 'RETIRED'; isPublic: boolean; sortOrder: number }
export interface SeedDiscount { type: 'TERM' | 'PROMO' | 'MIGRATION'; name: string; percentOff?: number; amountOffPaise?: number; conditions: Record<string, unknown>; stackable?: boolean; status?: 'PROPOSED' | 'APPROVED'; active?: boolean; validFrom?: string }
export interface SeedTax { name: string; ratePercent: number; appliesTo?: string; active?: boolean; validFrom?: string }
export interface SeedFile {
  version: 1;
  /** when the generated price rows take effect */
  effectiveFrom: string;
  plans: SeedPlan[];
  features: SeedFeature[];
  settings: Record<string, { value: unknown; description?: string }>;
  discountRules: SeedDiscount[];
  taxRates: SeedTax[];
  notes?: string;
}

export const PLAN_KEYS = ['handyman_free', 'handyman_pro', 'professional_free', 'professional_pro', 'ecommerce_free', 'ecommerce_pro'];
const STATES: CellState[] = ['ACTIVE', 'LIMITED', 'LOCKED_PREVIEW', 'HIDDEN'];
const KINDS = ['BOOLEAN', 'LIMIT', 'ENUM'];
const FEATURE_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ALL_TERMS = [1, 3, 6, 12];
const REQUIRED_SETTINGS = ['graceDays', 'allowMonthly', 'renewalReminderDays', 'downgradeBehaviour', 'upgradeProration', 'registrationProvisioning'];

export function validateSeedFile(seed: SeedFile): string[] {
  const errs: string[] = [];
  if (seed?.version !== 1) errs.push('version must be 1');
  if (!seed.effectiveFrom || Number.isNaN(Date.parse(seed.effectiveFrom))) errs.push('effectiveFrom must be an ISO date');
  const planKeys = (seed.plans ?? []).map((p) => p.key).sort();
  if (JSON.stringify(planKeys) !== JSON.stringify([...PLAN_KEYS].sort())) errs.push(`there must be exactly the six plans ${PLAN_KEYS.join(', ')}`);
  for (const p of seed.plans ?? []) {
    const [track, level] = p.key.split('_');
    if (p.track?.toLowerCase() !== track || p.level?.toLowerCase() !== level) errs.push(`plan ${p.key}: track/level do not match the key`);
  }
  const seen = new Set<string>();
  for (const f of seed.features ?? []) {
    if (seen.has(f.key)) errs.push(`duplicate feature ${f.key}`);
    seen.add(f.key);
    if (!FEATURE_KEY.test(f.key ?? '')) errs.push(`feature key ${f.key} is not dotted lower-case`);
    if (!KINDS.includes(f.kind)) errs.push(`feature ${f.key}: unknown kind ${f.kind}`);
    const cells: [string, SeedCell | undefined][] = [['free', f.free], ['pro', f.pro]];
    for (const [t, tv] of Object.entries(f.tracks ?? {})) { cells.push([`${t}.free`, tv?.free]); cells.push([`${t}.pro`, tv?.pro]); }
    for (const [where, c] of cells) {
      if (c === undefined && (where === 'free' || where === 'pro')) { errs.push(`feature ${f.key}: ${where} cell missing`); continue; }
      if (!c) continue;
      if (!STATES.includes(c.state)) errs.push(`feature ${f.key} ${where}: unknown state ${String(c.state)}`);
      if (c.state === 'LIMITED' && !(Number.isInteger(c.limit) && (c.limit as number) >= 0)) errs.push(`feature ${f.key} ${where}: LIMITED needs a whole-number limit`);
      if (c.limit !== undefined && !(Number.isInteger(c.limit) && c.limit >= 0)) errs.push(`feature ${f.key} ${where}: limit must be a whole number >= 0`);
      if (c.state === 'LOCKED_PREVIEW' && !(c.upsell ?? '').trim()) errs.push(`feature ${f.key} ${where}: LOCKED_PREVIEW needs upsell text`);
    }
  }
  for (const k of REQUIRED_SETTINGS) if (!(k in (seed.settings ?? {}))) errs.push(`setting ${k} is missing`);
  const dn = new Set<string>();
  for (const d of seed.discountRules ?? []) {
    const id = `${d.type}|${d.name}`;
    if (dn.has(id)) errs.push(`duplicate discount rule ${id}`);
    dn.add(id);
    if ((d.percentOff === undefined) === (d.amountOffPaise === undefined)) errs.push(`discount ${d.name}: give exactly one of percentOff and amountOffPaise`);
    if (d.percentOff !== undefined && !(d.percentOff >= 0 && d.percentOff <= 100)) errs.push(`discount ${d.name}: percentOff must be 0 to 100`);
    if (d.type === 'TERM' && !ALL_TERMS.includes(Number(d.conditions?.termMonths))) errs.push(`discount ${d.name}: TERM rule needs termMonths in ${ALL_TERMS.join(', ')}`);
  }
  for (const t of seed.taxRates ?? []) if (!(t.ratePercent >= 0)) errs.push(`tax ${t.name}: ratePercent must be >= 0`);
  return errs;
}

export interface ExpandedSeed {
  effectiveFrom: string;
  plans: SeedPlan[];
  features: { key: string; name: string; group: string; kind: string; unit: string | null; description: string | null; sortOrder: number }[];
  planFeatures: { planKey: string; featureKey: string; state: CellState; limitValue: number | null; enumValue: string | null; upsellText: string | null }[];
  settings: { key: string; valueJson: unknown; description: string | null }[];
  taxRates: { name: string; ratePercent: number; appliesTo: string; active: boolean; validFrom: string }[];
  discountRules: { type: string; name: string; percentOff: number | null; amountOffPaise: number | null; conditions: Record<string, unknown>; stackable: boolean; status: string; active: boolean; validFrom: string }[];
  prices: GeneratedPrice[];
}

export function expandSeed(seed: SeedFile): ExpandedSeed {
  const plans = seed.plans;
  const planFeatures: ExpandedSeed['planFeatures'] = [];
  for (const plan of plans) {
    const track = plan.key.split('_')[0] as TrackName;
    const lvl = plan.level === 'FREE' ? 'free' : 'pro';
    for (const f of seed.features) {
      const c = f.tracks?.[track]?.[lvl] ?? f[lvl];
      planFeatures.push({ planKey: plan.key, featureKey: f.key, state: c.state, limitValue: c.limit ?? null, enumValue: c.enum ?? null, upsellText: c.upsell ?? null });
    }
  }
  const settings = Object.entries(seed.settings).map(([key, s]) => ({ key, valueJson: s.value, description: s.description ?? null }));
  const base: Record<string, number> = {};
  for (const [k, s] of Object.entries(seed.settings)) if (k.startsWith('baseMonthlyPaise.') && typeof s.value === 'number') base[k.slice('baseMonthlyPaise.'.length)] = s.value;
  const allowMonthly = seed.settings.allowMonthly?.value === true;
  const termRules = seed.discountRules.filter((d) => d.type === 'TERM' && d.active !== false).map((d) => ({ termMonths: Number(d.conditions.termMonths), percentOff: d.percentOff ?? 0 }));
  const prices = generatePriceRows({
    plans: plans.map((p) => ({ key: p.key, level: p.level })),
    baseMonthlyPaise: base,
    termRules,
    allowedTerms: allowMonthly ? [1, 3, 6, 12] : [3, 6, 12],
    effectiveFrom: seed.effectiveFrom,
  });
  return {
    effectiveFrom: seed.effectiveFrom,
    plans,
    features: seed.features.map((f, i) => ({ key: f.key, name: f.name, group: f.group, kind: f.kind, unit: f.unit ?? null, description: f.description ?? null, sortOrder: f.sortOrder ?? (i + 1) * 10 })),
    planFeatures,
    settings,
    taxRates: seed.taxRates.map((t) => ({ name: t.name, ratePercent: t.ratePercent, appliesTo: t.appliesTo ?? 'ALL', active: t.active !== false, validFrom: t.validFrom ?? seed.effectiveFrom })),
    discountRules: seed.discountRules.map((d) => ({
      type: d.type, name: d.name, percentOff: d.percentOff ?? null, amountOffPaise: d.amountOffPaise ?? null, conditions: d.conditions,
      stackable: d.stackable === true, status: d.status ?? 'PROPOSED', active: d.active !== false, validFrom: d.validFrom ?? seed.effectiveFrom,
    })),
    prices,
  };
}
