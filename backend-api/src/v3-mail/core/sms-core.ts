/**
 * Pure rules of SMS (Amendment 12 Q7). Indian SMS needs DLT registration: a principal entity id, a sender id (header) and, for EVERY message, a template id that the operators approved, with the text
 * matching the template. Nothing here is invented: the entity id, sender id and template ids come from settings. Only transactional kinds exist; there is no promotional kind.
 */
export type Env = Readonly<Record<string, string | undefined>>;
export const SMS_KINDS = ['OTP'] as const;
export type SmsKind = (typeof SMS_KINDS)[number];

export interface SmsTemplate { templateId: string; text: string; kind: SmsKind; status: 'APPROVED' | 'PENDING' }
export interface DltConfig { principalEntityId: string; senderId: string; templates: Record<string, SmsTemplate> }
export interface SmsMessage { kind: string; to: string; templateKey: string; vars: string[] }
export interface DltRequest { principalEntityId: string; senderId: string; templateId: string; to: string; text: string }

export const PLACEHOLDER = '{#var#}';
export const MAX_VAR_LENGTH = 30;   // the DLT variable limit
export const MAX_TEXT_LENGTH = 600;
const KEY = /^[A-Z][A-Z0-9_]{2,39}$/;

export const principalEntityIdProblem = (v: unknown): string | null => (typeof v === 'string' && /^\d{10,30}$/.test(v) ? null : 'must be the digits of the DLT principal entity id');
export const senderIdProblem = (v: unknown): string | null => (typeof v === 'string' && /^[A-Za-z]{6}$/.test(v) ? null : 'must be a six-letter DLT sender id');

export function templatesProblem(v: unknown): string | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'must be an object of templates by key';
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 50) return 'must hold between 1 and 50 templates';
  for (const [k, t] of entries) {
    if (!KEY.test(k)) return `template key ${k} must be upper-case letters, digits and underscores`;
    const o = t as Partial<SmsTemplate> | null;
    if (!o || typeof o !== 'object') return `template ${k} is not an object`;
    if (typeof o.templateId !== 'string' || !/^\d{10,30}$/.test(o.templateId)) return `template ${k}: templateId must be the digits of the DLT template id`;
    if (typeof o.text !== 'string' || o.text.length === 0 || o.text.length > MAX_TEXT_LENGTH || /[\r]/.test(o.text)) return `template ${k}: text must be the approved template text`;
    if (!(SMS_KINDS as readonly string[]).includes(o.kind as string)) return `template ${k}: kind must be ${SMS_KINDS.join(' or ')}`;
    if (o.status !== 'APPROVED' && o.status !== 'PENDING') return `template ${k}: status must be APPROVED or PENDING`;
  }
  return null;
}

/** An Indian mobile number as 91 followed by ten digits, from the shapes people and our own records use. Anything else is not sent to. */
export function indianMobile(v: string): string | null {
  const d = v.replace(/[\s()+-]/g, '');
  if (!/^\d+$/.test(d)) return null;
  const n = d.length === 10 ? `91${d}` : d.length === 11 && d.startsWith('0') ? `91${d.slice(1)}` : d;
  return /^91[6-9]\d{9}$/.test(n) ? n : null;
}

export const smsFlag = (env: Env): boolean => env.SMS_LIVE_SEND === 'true';

export type SmsProblem = { code: 'SMS_KIND_FORBIDDEN' | 'SMS_INVALID' | 'SMS_TEMPLATE_NOT_APPROVED'; message: string };
/** Builds the request an operator will accept: the approved template with its variables in place. Refuses anything that would not match the template. */
export function buildDltRequest(cfg: DltConfig, m: SmsMessage): { ok: true; req: DltRequest } | { ok: false; problem: SmsProblem } {
  if (!(SMS_KINDS as readonly string[]).includes(m.kind)) return { ok: false, problem: { code: 'SMS_KIND_FORBIDDEN', message: 'That kind of message cannot be sent by SMS.' } };
  const to = indianMobile(m.to); if (!to) return { ok: false, problem: { code: 'SMS_INVALID', message: 'That is not an Indian mobile number.' } };
  const t = cfg.templates[m.templateKey];
  if (!t || t.status !== 'APPROVED' || t.kind !== m.kind) return { ok: false, problem: { code: 'SMS_TEMPLATE_NOT_APPROVED', message: 'That message has no approved template.' } };
  const slots = t.text.split(PLACEHOLDER).length - 1;
  if (m.vars.length !== slots || m.vars.some((x) => x.length === 0 || x.length > MAX_VAR_LENGTH || /[\r\n]/.test(x) || x.includes(PLACEHOLDER))) return { ok: false, problem: { code: 'SMS_INVALID', message: 'The message values do not fit the template.' } };
  let i = 0; const text = t.text.split(PLACEHOLDER).reduce((acc, part, idx) => (idx === 0 ? part : `${acc}${m.vars[i++]}${part}`), '');
  return { ok: true, req: { principalEntityId: cfg.principalEntityId, senderId: cfg.senderId, templateId: t.templateId, to, text } };
}
