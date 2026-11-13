import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OPT_IN_PROOF_FIELDS, PromoLimits } from './core/mail-rules-core';

/**
 * Promotion rules recorded as settings (Amendment 12 Q3). Recording them sends nothing: lane 3 sending does not exist in this block. Every value starts unset, and an unset limit means "nothing may be
 * sent" when the rules are read, never a built-in default. Edited through the one plan-settings API by SUPER_ADMIN.
 */
export interface MailRulesSettings {
  /** the most promotional messages one business may send in a day; null = none allowed */
  promoSendLimitPerDay: number | null;
  /** the most in a month; null = none allowed */
  promoSendLimitPerMonth: number | null;
  /** the daily cap for each day of a new business's warm-up, day 0 first (each at most the daily limit when it is read); null = no warm-up schedule recorded */
  promoWarmupDailyLimits: number[] | null;
  /** the complaint rate, in percent of messages sent, at which a business's promotions pause by themselves; null = none recorded */
  promoComplaintPausePercent: number | null;
  /** the bounce rate, in percent, at which they pause; null = none recorded */
  promoBouncePausePercent: number | null;
  /** the fields every stored opt-in proof must carry (from the list in the code); null = no proof can count as complete */
  promoOptInProofFields: string[] | null;
}
export const DEFAULT_MAIL_RULES_SETTINGS: Readonly<MailRulesSettings> = { promoSendLimitPerDay: null, promoSendLimitPerMonth: null, promoWarmupDailyLimits: null, promoComplaintPausePercent: null, promoBouncePausePercent: null, promoOptInProofFields: null };
export const MAIL_RULES_SETTING_KEYS = Object.keys(DEFAULT_MAIL_RULES_SETTINGS) as Array<keyof MailRulesSettings>;
export const isMailRulesSettingKey = (key: string): key is keyof MailRulesSettings => (MAIL_RULES_SETTING_KEYS as string[]).includes(key);
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1;

export function mailRulesSettingProblem(key: keyof MailRulesSettings, v: unknown): string | null {
  switch (key) {
    case 'promoSendLimitPerDay': case 'promoSendLimitPerMonth': return whole(v) ? null : 'must be a whole number above zero';
    case 'promoWarmupDailyLimits': return Array.isArray(v) && v.length >= 1 && v.length <= 90 && v.every(whole) ? null : 'must be a list of 1 to 90 whole numbers above zero (day 0 first)';
    case 'promoComplaintPausePercent': case 'promoBouncePausePercent': return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100 ? null : 'must be a percentage above 0 and at most 100';
    case 'promoOptInProofFields': return Array.isArray(v) && v.length >= 1 && new Set(v).size === v.length && v.every((f) => (OPT_IN_PROOF_FIELDS as readonly string[]).includes(f as string)) ? null : `must be a list of different fields from: ${OPT_IN_PROOF_FIELDS.join(', ')}`;
  }
}
export function validateMailRulesSetting(key: string, value: unknown): void {
  if (!isMailRulesSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = mailRulesSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveMailRulesSettings(rows: Map<string, unknown>): MailRulesSettings {
  const out = { ...DEFAULT_MAIL_RULES_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of MAIL_RULES_SETTING_KEYS) if (rows.has(k) && mailRulesSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as MailRulesSettings;
}
export const promoLimitsOf = (s: MailRulesSettings): PromoLimits => ({ perDay: s.promoSendLimitPerDay, perMonth: s.promoSendLimitPerMonth, warmupDaily: s.promoWarmupDailyLimits, complaintPausePercent: s.promoComplaintPausePercent, bouncePausePercent: s.promoBouncePausePercent });

@Injectable()
export class MailRulesSettingsService {
  private cached: { at: number; v: MailRulesSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<MailRulesSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: MAIL_RULES_SETTING_KEYS as string[] } } });
    const v = resolveMailRulesSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
