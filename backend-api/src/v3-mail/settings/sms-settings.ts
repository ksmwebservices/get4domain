import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsTemplate, principalEntityIdProblem, senderIdProblem, templatesProblem } from '../core/sms-core';

/** SMS (DLT) settings (Amendment 12 Q7, g4d_plan_settings). Nothing has a default: until staff record the registered values, SMS refuses. The provider key is the environment variable SMS_PROVIDER_API_KEY. */
export interface SmsSettings {
  /** the DLT principal entity id the operators registered for the company; null = SMS is refused */
  smsPrincipalEntityId: string | null;
  /** the six-letter DLT sender id (header); null = SMS is refused */
  smsSenderId: string | null;
  /** the registered templates by key (id, approved text, kind, status); only APPROVED ones can send; null = SMS is refused */
  smsTemplates: Record<string, SmsTemplate> | null;
}
export const DEFAULT_SMS_SETTINGS: Readonly<SmsSettings> = { smsPrincipalEntityId: null, smsSenderId: null, smsTemplates: null };
export const SMS_SETTING_KEYS = Object.keys(DEFAULT_SMS_SETTINGS) as Array<keyof SmsSettings>;
export const isSmsSettingKey = (key: string): key is keyof SmsSettings => (SMS_SETTING_KEYS as string[]).includes(key);

export function smsSettingProblem(key: keyof SmsSettings, v: unknown): string | null {
  switch (key) {
    case 'smsPrincipalEntityId': return principalEntityIdProblem(v);
    case 'smsSenderId': return senderIdProblem(v);
    case 'smsTemplates': return templatesProblem(v);
  }
}
export function validateSmsSetting(key: string, value: unknown): void {
  if (!isSmsSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = smsSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveSmsSettings(rows: Map<string, unknown>): SmsSettings {
  const out = { ...DEFAULT_SMS_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of SMS_SETTING_KEYS) if (rows.has(k) && smsSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as SmsSettings;
}

@Injectable()
export class SmsSettingsService {
  private cached: { at: number; v: SmsSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<SmsSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: SMS_SETTING_KEYS as string[] } } });
    const v = resolveSmsSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
