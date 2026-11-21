import { Inject, Injectable } from '@nestjs/common';
import { B3SettingsService } from '../b3-settings/b3-settings.service';
import { OtpPepper } from '../directory/pepper';
import { addressHash, Channel, chooseRoutes, maskAddress, Recipient, renderMessage, TemplateVars } from './core/messaging-core';
import { OutboxRow, RequestsStore } from './requests.store';

/**
 * Messaging in slice 5.14 is SANDBOX ONLY. The three adapters below record the message in the outbox as SENT_SANDBOX and send nothing; the settings API accepts only messagingMode "sandbox", and a live
 * attempt (env MESSAGING_LIVE_ENABLED=true) is FAILED plainly because no live adapter exists in this build. The recipient's address is stored only as a keyed hash and a masked form.
 */
export abstract class MessageAdapter { abstract readonly channel: Channel; abstract deliver(): 'SENT_SANDBOX' | 'FAILED'; }
class SandboxAdapter extends MessageAdapter {
  env: Record<string, string | undefined> = process.env;
  constructor(readonly channel: Channel) { super(); }
  deliver(): 'SENT_SANDBOX' | 'FAILED' { return this.env.MESSAGING_LIVE_ENABLED === 'true' ? 'FAILED' : 'SENT_SANDBOX'; }
}
export class WhatsAppSandboxAdapter extends SandboxAdapter { constructor() { super('WHATSAPP'); } }
export class SmsSandboxAdapter extends SandboxAdapter { constructor() { super('SMS'); } }
export class EmailSandboxAdapter extends SandboxAdapter { constructor() { super('EMAIL'); } }

export interface SendInput { vendorId: string | null; to: Recipient; templateKey: string; vars: TemplateVars; relatedRequestId?: string | null; bridge?: boolean }
export interface SendResult { channel: Channel | 'DASHBOARD'; senderRoute: string; status: OutboxRow['status']; id: string }

@Injectable()
export class MessagingService {
  clock: () => Date = () => new Date();
  adapters: MessageAdapter[] = [new WhatsAppSandboxAdapter(), new SmsSandboxAdapter(), new EmailSandboxAdapter()];

  constructor(private readonly store: RequestsStore, @Inject(B3SettingsService) private readonly b3: Pick<B3SettingsService, 'get'>, private readonly pepper: OtpPepper) {}

  /**
   * One message, one outbox row: the first usable channel in the order WhatsApp, SMS, email (a channel the recipient said STOP on is skipped); if a channel fails the next is tried; if none is left
   * the row is a DASHBOARD note the vendor sees. The text names the business, carries the bridge line when asked, and the stored payload holds no phone number or e-mail address.
   */
  async send(i: SendInput): Promise<SendResult> {
    const s = await this.b3.get(); const pepper = this.pepper.value(); const now = this.clock();
    const template = s.messageTemplates[i.templateKey] ?? '';
    const text = renderMessage(template, i.vars, i.bridge ? s.trackingBridgeText : undefined);
    const suppressed = { WHATSAPP: false, SMS: false, EMAIL: false };
    const phone = i.to.phone?.trim() || null; const email = i.to.email?.trim() || null;
    if (phone) { suppressed.WHATSAPP = await this.store.suppressed(addressHash('WHATSAPP', phone, pepper), 'WHATSAPP'); suppressed.SMS = await this.store.suppressed(addressHash('SMS', phone, pepper), 'SMS'); }
    if (email) suppressed.EMAIL = await this.store.suppressed(addressHash('EMAIL', email, pepper), 'EMAIL');
    const routes = chooseRoutes({ phone, email }, suppressed);
    const payload = { businessName: i.vars.businessName, reference: i.vars.reference ?? null, templateKey: i.templateKey, text };   // no address, no phone
    let last: OutboxRow | null = null; let delivered = false;
    for (const r of routes) {
      if (r.channel === 'DASHBOARD') {
        last = await this.store.addMessage({ vendorId: i.vendorId, channel: 'DASHBOARD', templateKey: i.templateKey, toHash: 'dashboard', toMasked: 'dashboard', payload, senderRoute: r.senderRoute, status: 'DELIVERED', attempts: 1, relatedRequestId: i.relatedRequestId ?? null }, now);
        break;
      }
      const address = r.channel === 'EMAIL' ? email! : phone!;
      const status = (this.adapters.find((a) => a.channel === r.channel) ?? new SandboxAdapter(r.channel)).deliver();
      last = await this.store.addMessage({ vendorId: i.vendorId, channel: r.channel, templateKey: i.templateKey, toHash: addressHash(r.channel, address, pepper), toMasked: maskAddress(r.channel, address), payload, senderRoute: r.senderRoute, status, attempts: 1, relatedRequestId: i.relatedRequestId ?? null }, now);
      if (status === 'SENT_SANDBOX') { delivered = true; break; }   // delivered to the sandbox: stop; a FAILED one falls through to the next route
    }
    if (!delivered && last && last.channel !== 'DASHBOARD') {
      // every channel failed: the last resort is the dashboard, where the vendor can still see it
      last = await this.store.addMessage({ vendorId: i.vendorId, channel: 'DASHBOARD', templateKey: i.templateKey, toHash: 'dashboard', toMasked: 'dashboard', payload, senderRoute: 'DASHBOARD', status: 'DELIVERED', attempts: 1, relatedRequestId: i.relatedRequestId ?? null }, now);
    }
    return { channel: last!.channel, senderRoute: last!.senderRoute, status: last!.status, id: last!.id };
  }

  /** A recipient said STOP: that address stops getting messages on that channel (both WhatsApp and SMS for a phone). Recorded once; honoured by the router. */
  async stop(address: string, channel: Channel | 'PHONE'): Promise<boolean> {
    const pepper = this.pepper.value(); let added = false;
    const channels: Channel[] = channel === 'PHONE' ? ['WHATSAPP', 'SMS'] : [channel];
    for (const c of channels) added = (await this.store.addSuppression(addressHash(c, address, pepper), c)) || added;
    return added;
  }
}
