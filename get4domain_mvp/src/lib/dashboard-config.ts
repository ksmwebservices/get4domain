'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

// Mirror of backend IndustryConfig (see backend-api/src/config/industries/types.ts)
export interface DashboardTab {
  key: string;
  label: string;
  icon: string;
}
export interface RecordStatus {
  key: string;
  label: string;
  color: string;
}
export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
}
export interface QuickAction {
  key: string;
  label: string;
  icon: string;
  href: string;
}
export interface IndustrySkin {
  accentColor: string;
  accentColorDark: string;
  welcomeText: string;
  quickActions: QuickAction[];
}
export interface IndustryConfig {
  key: string;
  label: string;
  icon: string;
  skin?: IndustrySkin;
  entities: {
    contact: { label: string; labelPlural: string };
    catalogItem: { label: string; labelPlural: string };
    record: { label: string; labelPlural: string };
  };
  recordStatuses: RecordStatus[];
  recordCustomFields: CustomField[];
  catalogCustomFields: CustomField[];
  defaultAddons: string[];
  availableAddons: string[];
  websiteTemplate: string;
  dashboardTabs: DashboardTab[];
}

export interface ToggleState {
  key: string;
  label: string;
  enabled: boolean;
}

export interface DashboardConfig {
  industry: IndustryConfig | null;
  modules: Record<string, boolean>;
  addons: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

/**
 * Maps an industry dashboardTab.key to the addon it requires (if any). Core
 * tabs (records/contacts/catalog/billing) are not in this map and are gated by
 * the `domainapp` module instead.
 */
export const TAB_ADDON_REQUIREMENT: Record<string, string> = {
  fleet: 'fleet',
  drivers: 'driver',
  contracts: 'fleet', // recurring contracts assign fleet vehicles — gate on the fleet addon
  // 'trip-sheets' is now the core Trips builder (Phase 1) — no longer addon-gated.
  tables: 'table_management',
  housekeeping: 'room_management',
  rooms: 'room_management',
  gallery: 'gallery_management',
  attendance: 'attendance_tracking',
  materials: 'inventory_management',
  inventory: 'inventory_management',
  documents: 'document_management',
  vendors: 'vendor_coordination',
};

function toRecord(list: ToggleState[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const item of list) out[item.key] = item.enabled;
  return out;
}

const CACHE_PREFIX = 'g4d_dashcfg_';

/**
 * Fetches (and caches per session) the vendor's industry config, module states,
 * and addon states. Drives the config-driven dashboard shell.
 */
export function useDashboardConfig(industryKey?: string): DashboardConfig {
  const [state, setState] = useState<DashboardConfig>({
    industry: null,
    modules: {},
    addons: {},
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const key = industryKey || 'general';
    const cacheKey = `${CACHE_PREFIX}${key}`;

    // Hydrate instantly from session cache if present.
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Omit<DashboardConfig, 'loading' | 'error'>;
          setState({ ...parsed, loading: false, error: null });
        } catch {
          /* ignore corrupt cache */
        }
      }
    }

    async function load() {
      try {
        const [industryRes, modulesRes, addonsRes] = await Promise.all([
          // 3C — prefer the caller-vendor's resolved config (industry skin + admin
          // per-vendor override), falling back to the plain industry config.
          api.getMyIndustryConfig().catch(() => api.getIndustryConfig(key)),
          api.getVendorModules(),
          api.getVendorAddons(),
        ]);
        if (cancelled) return;
        const next = {
          industry: industryRes.data as IndustryConfig,
          modules: toRecord(modulesRes.data as ToggleState[]),
          addons: toRecord(addonsRes.data as ToggleState[]),
        };
        setState({ ...next, loading: false, error: null });
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(next));
        }
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load dashboard config',
        }));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [industryKey]);

  return state;
}
