import { ActivityBus } from '../../src/common/activity-bus';
import { EnquiryFormService } from '../../src/requests-orders/enquiry-form.service';
import { FakeConsent } from '../../src/v3-mail/consent.port';
import { FakeEmailTransport, GuardedEmailPort } from '../../src/v3-mail/email.port';
import { InboxService } from '../../src/v3-mail/inbox.service';
import { DEFAULT_MAIL_SETTINGS, MailSettings, MailSettingsService } from '../../src/v3-mail/settings/mail-settings';
import { MemoryInboxStore } from './memory-inbox-store';
import { RW } from './requests-world';

/** The enquiry form service over a requests world: an in-memory inbox, a fake mail transport and a consent gate the test can publish. */
export function enquiryWorld(w: RW, o: { mail?: Partial<MailSettings>; env?: Record<string, string> } = {}) {
  const inboxStore = new MemoryInboxStore();
  const mail = { get: async () => ({ ...DEFAULT_MAIL_SETTINGS, mailSystemFromAddress: 'no-reply@send.example.com', mailSystemFromName: 'Get4Domain', inboxMaxBytes: 10_000, inboxRatePerHour: 3, inboxSpamThreshold: 5, ...o.mail }) } as unknown as MailSettingsService;
  const env = { EMAIL_LIVE_SEND: 'true', EMAIL_FORWARD_LIVE: 'true', ...o.env };
  const transport = new FakeEmailTransport(); const email = new GuardedEmailPort(transport, mail, () => env);
  const bus = new ActivityBus(); const events: string[] = []; bus.on('*', (e) => { events.push(e.type); });
  const consent = new FakeConsent();
  const ents = { resolve: async (v: string) => w.ents.get(v) } as never;
  const inbox = new InboxService(inboxStore, email, mail, ents, consent, bus, () => env); inbox.clock = () => new Date(w.now.t);
  const svc = new EnquiryFormService(w.pub, inbox, { get: async () => ({ requestDuplicateWindowMinutes: 10, customerConsentVersion: 1, ...w.b3.over }) } as never, ents, mail, consent, bus);
  svc.clock = () => new Date(w.now.t);
  return { svc, inboxStore, transport, events, consent, inbox };
}
