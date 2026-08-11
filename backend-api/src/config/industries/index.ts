import { IndustryConfig } from './types';
import { generalConfig } from './general';
import { travelConfig } from './travel';
import { restaurantConfig } from './restaurant';
import { clinicConfig } from './clinic';
import { hotelConfig } from './hotel';
import { salonConfig } from './salon';
import { gymConfig } from './gym';
import { realestateConfig } from './realestate';
import { educationConfig } from './education';
import { retailConfig } from './retail';
import { constructionConfig } from './construction';
import { eventsConfig } from './events';
import { financeConfig } from './finance';
import { automobileConfig } from './automobile';
import { logisticsConfig } from './logistics';
import { diagnosticsConfig } from './diagnostics';
import { photographyConfig } from './photography';
import { professionalConfig } from './professional';
import { agricultureConfig } from './agriculture';
import { coachingConfig } from './coaching';
import { technologyConfig } from './technology';

export * from './types';

export const INDUSTRY_CONFIGS: Record<string, IndustryConfig> = {
  general: generalConfig,
  travel: travelConfig,
  restaurant: restaurantConfig,
  clinic: clinicConfig,
  hotel: hotelConfig,
  salon: salonConfig,
  gym: gymConfig,
  realestate: realestateConfig,
  education: educationConfig,
  retail: retailConfig,
  construction: constructionConfig,
  events: eventsConfig,
  finance: financeConfig,
  automobile: automobileConfig,
  logistics: logisticsConfig,
  diagnostics: diagnosticsConfig,
  photography: photographyConfig,
  professional: professionalConfig,
  agriculture: agricultureConfig,
  coaching: coachingConfig,
  technology: technologyConfig,
};

// Canonical slug aliases: the marketing site (/industries, sitemap) uses these
// SEO slugs, while the DomainApp configs historically used different keys. Map
// them so /demo/[industry], seedVendor(), and the industries API all resolve the
// same canonical id to one config. Keeping both keys avoids a risky rename.
export const INDUSTRY_ALIASES: Record<string, string> = {
  healthcare: 'clinic',
  beauty: 'salon',
  fitness: 'gym',
};

/** Resolve a canonical/alias slug to its config key. */
export function resolveIndustryKey(key?: string | null): string | null {
  if (!key) return null;
  if (INDUSTRY_CONFIGS[key]) return key;
  const alias = INDUSTRY_ALIASES[key];
  return alias && INDUSTRY_CONFIGS[alias] ? alias : null;
}

/** Returns the config for `key` (accepts canonical aliases), falling back to `general`. */
export function getIndustryConfig(key?: string | null): IndustryConfig {
  const resolved = resolveIndustryKey(key);
  return resolved ? INDUSTRY_CONFIGS[resolved] : INDUSTRY_CONFIGS.general;
}

/** Lightweight list of all industries for dropdowns (key + label + icon). */
export function listIndustries(): { key: string; label: string; icon: string }[] {
  return Object.values(INDUSTRY_CONFIGS).map((c) => ({
    key: c.key,
    label: c.label,
    icon: c.icon,
  }));
}
