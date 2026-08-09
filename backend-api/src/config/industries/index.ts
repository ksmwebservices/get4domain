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

/** Returns the config for `key`, falling back to `general` for unknown keys. */
export function getIndustryConfig(key?: string | null): IndustryConfig {
  if (key && INDUSTRY_CONFIGS[key]) {
    return INDUSTRY_CONFIGS[key];
  }
  return INDUSTRY_CONFIGS.general;
}

/** Lightweight list of all industries for dropdowns (key + label + icon). */
export function listIndustries(): { key: string; label: string; icon: string }[] {
  return Object.values(INDUSTRY_CONFIGS).map((c) => ({
    key: c.key,
    label: c.label,
    icon: c.icon,
  }));
}
