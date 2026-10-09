/**
 * The WhatsApp provider abstraction (Dispatch A section 6, built here because it did not exist).
 * One implementation per provider, chosen by configuration: the Meta Cloud API (or a BSP speaking the same shape) and a sandbox for tests.
 * The interface is deliberately small: send a TEMPLATE message, receive a webhook, verify its signature, report delivery status.
 * There is no "send free text" method: the common Get4Domain number only ever sends approved templates.
 */
export type TemplateCategory = 'AUTHENTICATION' | 'UTILITY';
export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface TemplateMessage {
  /** E.164 digits without plus, for example 919876543210 */
  to: string;
  template: string;
  language: string;
  category: TemplateCategory;
  /** values for {{1}}, {{2}}... in order */
  variables: string[];
  /** the provider's own id for the approved template, when it differs from the name */
  providerTemplateId?: string | null;
}
export interface SendResult { providerMessageId: string; status: DeliveryStatus }
export interface StatusUpdate { providerMessageId: string; status: DeliveryStatus; error?: string }
export interface InboundMessage { from: string; text?: string; providerMessageId: string }
export interface ParsedWebhook { statuses: StatusUpdate[]; inbound: InboundMessage[] }

export interface WhatsappProvider {
  readonly name: string;
  /** Sandbox providers deliver nothing to a phone; the gateway treats every template as usable. */
  readonly sandbox: boolean;
  sendTemplate(message: TemplateMessage): Promise<SendResult>;
  /** Turn the provider's webhook body into delivery updates and inbound messages. */
  parseWebhook(body: unknown): ParsedWebhook;
  /** True only when the signature header matches the raw body. */
  verifySignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean;
  /** Webhook subscription handshake (GET): returns the challenge to echo, or null to refuse. */
  verifyHandshake(query: Record<string, string | undefined>): string | null;
}

export class WhatsappSendError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}
