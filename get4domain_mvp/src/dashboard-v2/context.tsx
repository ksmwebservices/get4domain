'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiCall } from '@/lib/api';
import { FEATURES, featureState, type Feature, type FeatureState, type PlanKey, type Profile, type VendorFacts } from '@/lib/nav.generated';

/** What GET /dashboard/context returns (backend DashboardContextService). */
export interface V2Context {
  vendorId: string;
  businessName: string;
  industry: string;
  profile: Profile;
  plan: PlanKey | null;
  planDisplay: string;
  custom: boolean;
  navV2: boolean;
  principal: 'owner' | 'team_member' | 'sandbox';
  memberAreas: string[] | null;
  term: { status: string; paymentDueAt: string | null; periodEnd: string | null; graceDays: number } | null;
  paymentDue: { invoiceId: string; invoiceNumber: string; totalPaise: number; dueDate: string | null; overdue: boolean } | null;
  signals: { productsAdded: number; paymentsConnected: boolean; domainConnected: boolean; seoBasics: boolean; firstLead: boolean; newLeads7d: number; pendingOrders: number; lowStock: number };
}

interface V2Value {
  ctx: V2Context | null;
  loading: boolean;
  error: string;
  facts: VendorFacts | null;
  reload: () => void;
}

const V2 = createContext<V2Value | null>(null);

/** Null outside the Dashboard v2 shell (the old dashboard has no such context). */
export function useV2(): V2Value | null {
  return useContext(V2);
}

export function V2Provider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<V2Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiCall('/dashboard/context')
      .then((r) => { setCtx((r.data ?? r) as V2Context); setError(''); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your dashboard'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const facts = useMemo<VendorFacts | null>(() => (ctx ? { plan: ctx.plan, custom: ctx.custom, profile: ctx.profile, navV2: true } : null), [ctx]);
  const value = useMemo<V2Value>(() => ({ ctx, loading, error, facts, reload: load }), [ctx, loading, error, facts, load]);
  return <V2.Provider value={value}>{children}</V2.Provider>;
}

/** The state a feature has for THIS vendor, honouring a team member's access areas (plan access ∩ the member's role). */
export function stateFor(f: Feature, v: V2Value | null): FeatureState {
  if (!v?.facts || !v.ctx) return 'HIDDEN';
  const base = featureState(f, v.facts);
  if (base === 'HIDDEN') return base;
  if (v.ctx.memberAreas && !memberCanSee(f, v.ctx.memberAreas)) return 'HIDDEN';
  return base;
}

// ── Team members: the menu is the intersection of plan access and the member's areas. The server (ModuleGuard) is the real boundary. ──
const AREA_BY_MODULE: Record<string, string> = { growth_hub: 'campaigns', telecrm: 'telecrm', communication_hub: 'communication', website_manager: 'website', analytics_hub: 'reports' };
const AREA_BY_FEATURE: Record<string, string> = { 'marketing.ai-studio': 'ai_studio', 'finance.expenses': 'accounts', 'account.wallet': 'wallet', 'sales.leads': 'telecrm', 'communication.notifications': '' };
/** Owner-only: a team member never sees these. */
const OWNER_ONLY = new Set(['people.team', 'account.billing', 'account.profile', 'account.connections', 'account.disclosures', 'account.stationery']);

export function memberCanSee(f: Feature, areas: string[]): boolean {
  if (OWNER_ONLY.has(f.id)) return false;
  const area = AREA_BY_FEATURE[f.id] ?? (f.moduleKey ? AREA_BY_MODULE[f.moduleKey] : undefined);
  if (!area) return true; // base items (Home, Notifications, Help, …) are visible to every member
  return areas.includes(area);
}

export { FEATURES };
