import { Injectable, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { KeyedQueue } from '../common/keyed-queue';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { Env, InboundInput, checkInbound, forwardSubject, forwardText, planActive, spamVerdict, subdomainOfAddress, underRateLimit, verifySignature } from './core/mail-core';
import { EmailPort } from './email.port';
import { InboxRow, InboxStore } from './inbox.store';
import { mailError } from './mail.errors';
import { MailSettingsService } from './settings/mail-settings';

const queue = new KeyedQueue();
const HOUR_MS = 3_600_000;
const view = (r: InboxRow, full: boolean) => ({
  id: r.id, from: r.fromAddress, fromName: r.fromName, subject: r.subject, receivedAt: r.createdAt, state: r.state, spam: r.spamVerdict === 'SPAM', forwardStatus: r.forwardStatus,
  ...(full ? { to: r.toAddress, body: r.bodyText } : { preview: r.bodyText.slice(0, 160) }),
});

/**
 * The enquiry inbox (Amendment 12 Q5). The Cloudflare Email Worker posts each message to `receive` with a signed request. Order of checks: the signature (HMAC, with a replay window), the settings are set,
 * the message is well formed and within the size cap, the address belongs to a business, its plan stands, and the business is under its hourly rate limit (counted and inserted one at a time per
 * business BEFORE any transaction). The message is stored text-only with its spam score; a message over the spam threshold is kept but never forwarded. Forwarding goes through the guarded EmailPort
 * (flag EMAIL_FORWARD_LIVE, default OFF) to the business's own address with Reply-To set to the original sender. Forwarding stops when the plan ends because the plan is checked on every message.
 */
@Injectable()
export class InboxService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly store: InboxStore, private readonly email: EmailPort, private readonly settings: MailSettingsService, private readonly entitlements: EntitlementsService,
    @Optional() private readonly bus?: ActivityBus, @Optional() private readonly env: () => Env = () => process.env,
  ) {}

  async receive(rawBody: string, signature: string | undefined, body: Record<string, unknown>) {
    const now = this.clock();
    if (!verifySignature(this.env().INBOUND_EMAIL_SECRET, signature, rawBody, Math.floor(now.getTime() / 1000))) throw mailError(401, 'INBOX_SIGNATURE_INVALID', 'The request could not be verified.');
    const s = await this.settings.get();
    if (s.inboxMaxBytes === null || s.inboxRatePerHour === null || s.inboxSpamThreshold === null) throw mailError(503, 'INBOX_NOT_CONFIGURED', 'The enquiry inbox is not switched on yet.');
    const c = checkInbound(body); if (!c.ok) throw mailError(400, 'INBOX_INVALID', c.problems.join('; '));
    const m = c.value;
    if (m.sizeBytes > s.inboxMaxBytes || Buffer.byteLength(m.text) > s.inboxMaxBytes) throw mailError(413, 'INBOX_TOO_LARGE', 'That message is too large.');
    const sub = subdomainOfAddress(m.to, this.env().SITE_BASE_DOMAIN || 'get4domain.com');
    const vendor = sub ? await this.store.vendorBySubdomain(sub) : null;
    if (!vendor) throw mailError(404, 'INBOX_VENDOR_UNKNOWN', 'No business owns that address.');
    if (!planActive(await this.entitlements.resolve(vendor.id))) throw mailError(403, 'INBOX_PLAN_INACTIVE', 'That business cannot receive enquiries right now.');

    const verdict = spamVerdict(m.spamScore, s.inboxSpamThreshold);
    const stored = await queue.run(`inbox:${vendor.id}`, async () => {
      if (!underRateLimit(await this.store.countSince(vendor.id, new Date(now.getTime() - HOUR_MS)), s.inboxRatePerHour!)) throw mailError(429, 'INBOX_RATE_LIMITED', 'Too many messages for that business. Try again later.');
      return this.store.insertIfNew(vendor.id, { toAddress: m.to, fromAddress: m.from, fromName: m.fromName, subject: m.subject, bodyText: m.text, messageIdHdr: m.messageId, sizeBytes: m.sizeBytes, spamScore: m.spamScore, spamVerdict: verdict, state: 'NEW', forwardStatus: 'PENDING' }, now);
    });
    if (!stored.created) return { accepted: true, id: stored.row.id, duplicate: true, forwardStatus: stored.row.forwardStatus };   // the same message id again: nothing is stored or sent twice
    this.emit('inbox.message_received', vendor.id, stored.row.id, { spam: verdict === 'SPAM' });
    const forwardStatus = await this.forward(vendor, stored.row.id, m, verdict === 'SPAM');
    return { accepted: true, id: stored.row.id, duplicate: false, forwardStatus };
  }

  private async forward(vendor: { id: string; email: string }, id: string, m: InboundInput, spam: boolean): Promise<string> {
    let status: string; let at: Date | null = null;
    if (spam) status = 'SKIPPED_SPAM';
    else {
      try {
        await this.email.send({ lane: 'SYSTEM', kind: 'ENQUIRY_FORWARD', to: vendor.email, subject: forwardSubject(m.subject), text: forwardText(m), replyTo: m.from, fromName: m.fromName });
        status = 'FORWARDED'; at = this.clock();
      } catch (e) { status = (e as { response?: { code?: string } }).response?.code === 'EMAIL_NOT_LIVE' ? 'SKIPPED_FLAG_OFF' : 'FAILED'; }
    }
    await this.store.setForward(vendor.id, id, status, at);
    if (status === 'FORWARDED') this.emit('inbox.message_forwarded', vendor.id, id, {});
    return status;
  }

  async list(vendorId: string, state: string | undefined, page: number, pageSize: number) {
    await this.assertPlan(vendorId);
    const r = await this.store.list(vendorId, { state, excludeHeld: true }, (page - 1) * pageSize, pageSize);
    return { items: r.items.map((x) => view(x, false)), total: r.total };
  }
  async get(vendorId: string, id: string) {
    await this.assertPlan(vendorId);
    const r = await this.store.get(vendorId, id);
    if (!r || r.state === 'HELD') throw mailError(404, 'INBOX_NOT_FOUND', 'That message was not found.');
    return view(r, true);
  }
  async setState(vendorId: string, id: string, state: string) {
    await this.assertPlan(vendorId);
    if (!['READ', 'ARCHIVED', 'NEW'].includes(state)) throw mailError(400, 'INBOX_INVALID', 'Choose read, archived or new.');
    const r = await this.store.setState(vendorId, id, state, this.clock());
    if (!r) throw mailError(404, 'INBOX_NOT_FOUND', 'That message was not found.');
    return view(r, true);
  }
  private async assertPlan(vendorId: string): Promise<void> {
    if (!planActive(await this.entitlements.resolve(vendorId))) throw mailError(403, 'INBOX_PLAN_INACTIVE', 'Your plan does not include the enquiry inbox right now.');
  }
  private emit(type: string, vendorId: string, id: string, data: Record<string, unknown>): void { void this.bus?.emit({ type, vendorId, at: this.clock(), actor: { type: 'SYSTEM', id: null }, data: { messageId: id, ...data } }); }
}
