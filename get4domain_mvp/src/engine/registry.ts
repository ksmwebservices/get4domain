import type { ComponentType } from 'react';
import type { EngineMode, EngineSiteData, IndustryWebsite } from './types';
import { realEstateWebsite } from './industries/real-estate/config';
import RealEstateSite from './industries/real-estate/RealEstateSite';

/**
 * The Industry Website Engine registry — the single extension point.
 *
 * Adding a new industry to the engine is exactly ONE entry here: its config
 * (theme + journey + readiness) and its bespoke Site component. The engine core
 * (theme scope, action dispatch, site route, preview, publishing) never changes.
 * Real Estate is the reference entry; other industries fall back to the existing
 * generic renderer until they are built on this same engine.
 */
export interface EngineIndustryEntry {
  config: IndustryWebsite;
  Site: ComponentType<{ site: EngineSiteData; mode: EngineMode }>;
}

const REGISTRY: Record<string, EngineIndustryEntry> = {
  realestate: { config: realEstateWebsite, Site: RealEstateSite },
};

export function getEngineIndustry(key: string): EngineIndustryEntry | null {
  return REGISTRY[key] ?? null;
}

export function hasEngineSite(key: string): boolean {
  return key in REGISTRY;
}

export function listEngineIndustries(): string[] {
  return Object.keys(REGISTRY);
}
