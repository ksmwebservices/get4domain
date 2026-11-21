import { BadRequestException } from '@nestjs/common';
import { FEATURE_KEYS } from '../core/features';

/** Editable settings of slice 5.11 (g4d_plan_settings, edited by SUPER_ADMIN through the existing plan-settings API). Defaults are documented here; none is a price. */
export interface AiSettings {
  /** false (default): NO real model is ever called; every request is answered by the deterministic mock. true: the ACTIVE provider whose secret decrypts is used. */
  aiLiveCalls: boolean;
  /** credits one request costs, per feature */
  aiCreditCosts: Record<string, number>;
  /** the longest suggestion that is returned, per feature, in characters */
  aiOutputMaxChars: Record<string, number>;
  /** the longest free-text hint (keyPoints) a request may carry */
  aiMaxInputChars: number;
  /** words that may never appear in a suggestion (case-insensitive, whole words) */
  aiBannedWords: string[];
}

export const DEFAULT_AI_SETTINGS: Readonly<AiSettings> = {
  aiLiveCalls: false,
  aiCreditCosts: { site_copy: 1, seo_suggestion: 1, directory_description: 1, review_reply: 1 },
  aiOutputMaxChars: { site_copy: 600, seo_suggestion: 160, directory_description: 600, review_reply: 500 },
  aiMaxInputChars: 500,
  aiBannedWords: ['workspace', 'bos', 'leadspace', 'online identity'],
};
export const AI_SETTING_KEYS = Object.keys(DEFAULT_AI_SETTINGS) as Array<keyof AiSettings>;
export const isAiSettingKey = (key: string): key is keyof AiSettings => (AI_SETTING_KEYS as string[]).includes(key);

const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const featureMap = (v: unknown, min: number, max: number): boolean => !!v && typeof v === 'object' && !Array.isArray(v)
  && FEATURE_KEYS.every((k) => intIn((v as Record<string, unknown>)[k], min, max)) && Object.keys(v as object).every((k) => (FEATURE_KEYS as readonly string[]).includes(k));

export function aiSettingProblem(key: keyof AiSettings, value: unknown): string | null {
  switch (key) {
    case 'aiLiveCalls': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'aiCreditCosts': return featureMap(value, 1, 100) ? null : `must give a whole number from 1 to 100 for each of ${FEATURE_KEYS.join(', ')}`;
    case 'aiOutputMaxChars': return featureMap(value, 20, 2000) ? null : `must give a whole number from 20 to 2000 for each of ${FEATURE_KEYS.join(', ')}`;
    case 'aiMaxInputChars': return intIn(value, 20, 2000) ? null : 'must be a whole number from 20 to 2000';
    case 'aiBannedWords': return Array.isArray(value) && value.length <= 200 && value.every((w) => typeof w === 'string' && w.trim().length >= 2 && w.length <= 60) ? null : 'must be a list of up to 200 words or phrases of 2 to 60 characters';
  }
}

export function validateAiSetting(key: string, value: unknown): void {
  if (!isAiSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = aiSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

export function resolveAiSettings(stored: ReadonlyMap<string, unknown>): AiSettings {
  const out: Record<string, unknown> = { ...DEFAULT_AI_SETTINGS };
  for (const key of AI_SETTING_KEYS) if (stored.has(key) && aiSettingProblem(key, stored.get(key)) === null) out[key] = stored.get(key);
  return out as unknown as AiSettings;
}
