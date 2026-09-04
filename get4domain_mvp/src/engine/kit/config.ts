import type { EngineActionSpec, IndustryWebsite } from '../types';
import { THEMES } from './themes';
import { genericReadiness } from '../readiness';

/** Build an IndustryWebsite config for a kit industry (metadata for the dashboard/
 *  readiness; the actual bespoke composition lives in the industry's builder). */
export function kitConfig(key: string, label: string, primary: EngineActionSpec): IndustryWebsite {
  return {
    key,
    label,
    theme: THEMES[key],
    primaryCta: primary,
    secondaryCtas: [{ intent: 'engine.enquiry', label: 'Enquire', kind: 'enquiry' }],
    sectionOrder: [],
    readiness: genericReadiness,
  };
}
