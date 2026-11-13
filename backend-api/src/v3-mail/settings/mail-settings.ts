import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hasLineBreak, looksLikeEmail } from '../core/mail-core';

/**
 * Mail and inbox settings (Amendment 12 Q3 and Q5, stored in g4d_plan_settings). Nothing has an invented default: an unset value keeps its feature off. The Resend key is the environment variable
 * RESEND_API_KEY (never a setting); the inbound signing secret is INBOUND_EMAIL_SECRET.
 */
export interface MailSettings {
  /** lane 1 sender address on the send subdomain; null = system mail is refused */
  mailSystemFromAddress: string | null;
  /** lane 1 display name; null = system mail is refused */
  mailSystemFromName: string | null;
  /** the biggest enquiry message, in bytes, the inbox accepts; null = inbound is refused */
  inboxMaxBytes: number | null;
  /** most enquiry messages one business may receive in an hour; null = inbound is refused */
  inboxRatePerHour: number | null;
  /** a spam score above this marks a message SPAM (kept, not forwarded); null = inbound is refused */
  inboxSpamThreshold: number | null;
}
export const DEFAULT_MAIL_SETTINGS: Readonly<MailSettings> = { mailSystemFromAddress: null, mailSystemFromName: null, inboxMaxBytes: null, inboxRatePerHour: null, inboxSpamThreshold: null };
export const MAIL_SETTING_KEYS = Object.keys(DEFAULT_MAIL_SETTINGS) as Array<keyof MailSettings>;
export const isMailSettingKey = (key: string): key is keyof MailSettings => (MAIL_SETTING_KEYS as string[]).includes(key);
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

export function mailSettingProblem(key: keyof MailSettings, v: unknown): string | null {
  switch (key) {
    case 'mailSystemFromAddress': return looksLikeEmail(v) ? null : 'must be an email address';
    case 'mailSystemFromName': return typeof v === 'string' && v.trim().length > 0 && v.length <= 80 && !hasLineBreak(v) ? null : 'must be a short name on one line';
    case 'inboxSpamThreshold': return typeof v === 'number' && Number.isFinite(v) ? null : 'must be a number';
    default: return whole(v) ? null : 'must be a whole number above zero';
  }
}
export function validateMailSetting(key: string, value: unknown): void {
  if (!isMailSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = mailSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveMailSettings(rows: Map<string, unknown>): MailSettings {
  const out = { ...DEFAULT_MAIL_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of MAIL_SETTING_KEYS) if (rows.has(k) && mailSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as MailSettings;
}

@Injectable()
export class MailSettingsService {
  private cached: { at: number; v: MailSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<MailSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: MAIL_SETTING_KEYS as string[] } } });
    const v = resolveMailSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
