import { checkMessageBody, checkNewTicket, statusAfterStaffReply, statusAfterVendorReply } from '../src/v3-support/core/support-core';
import { DEFAULT_SUPPORT_SETTINGS, SupportSettings, SupportSettingsService, resolveSupportSettings, supportSettingProblem } from '../src/v3-support/settings/support-settings';
import { FakeTicketNotifier, SupportService } from '../src/v3-support/support.service';
import { MemorySupportStore } from './support/memory-support-store';

const A = { type: 'VENDOR' as const, id: 'v1', ip: null }; const STAFF = { type: 'STAFF' as const, id: 's1', ip: null }; const NOW = new Date('2026-11-14T10:00:00Z');
function make(over: Partial<SupportSettings> = {}) {
  const store = new MemorySupportStore(); store.emails.set('v1', 'owner@a.example'); store.subdomains.set('acme', 'v1'); store.pictures.add('v1:pic1');
  const settings = { get: async () => ({ ...DEFAULT_SUPPORT_SETTINGS, ticketCreatePerHour: 3, ticketPublicPerHour: 2, ...over }) } as unknown as SupportSettingsService;
  const notifier = new FakeTicketNotifier(); const svc = new SupportService(store, settings, notifier); svc.clock = () => NOW;
  return { svc, store, notifier };
}

describe('support ticket core', () => {
  it('checks a new ticket and reports every problem', () => {
    expect(checkNewTicket({ subject: 'Site down', body: 'Help' })).toMatchObject({ ok: true, value: { category: 'GENERAL' } });
    const r = checkNewTicket({ subject: 'x', category: 'NOPE', body: '   ' }); expect(r.ok).toBe(false); expect(!r.ok && r.problems).toHaveLength(3);
    expect(checkMessageBody('a'.repeat(5001))).toBeNull(); expect(checkMessageBody('ok\u0000')).toBe('ok');
  });
  it('status moves: a business wakes a waiting or resolved ticket; staff answer an open one and wait; a resolved one stays resolved', () => {
    expect(statusAfterVendorReply('WAITING_VENDOR')).toBe('OPEN'); expect(statusAfterVendorReply('RESOLVED')).toBe('OPEN'); expect(statusAfterVendorReply('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(statusAfterStaffReply('OPEN')).toBe('WAITING_VENDOR'); expect(statusAfterStaffReply('IN_PROGRESS')).toBe('WAITING_VENDOR'); expect(statusAfterStaffReply('RESOLVED')).toBe('RESOLVED');
  });
  it('settings start unset and need whole numbers', () => {
    expect(Object.values(resolveSupportSettings(new Map())).every((v) => v === null)).toBe(true); expect(supportSettingProblem('ticketCreatePerHour', 0)).not.toBeNull(); expect(supportSettingProblem('ticketCreatePerHour', 5)).toBeNull();
  });
});

describe('support tickets: a business', () => {
  it('opens a ticket with a first message, lists it, reads it, and replies', async () => {
    const { svc } = make(); const t = await svc.create('v1', A, { subject: 'Domain question', category: 'DOMAIN', body: 'How do I connect?' });
    expect(t).toMatchObject({ status: 'OPEN', category: 'DOMAIN', requesterType: 'VENDOR' }); expect(t.messages).toHaveLength(1);
    expect((await svc.list('v1', 1, 20)).total).toBe(1);
    await svc.reply('v1', A, t.id, { body: 'More detail' }); expect((await svc.get('v1', t.id)).messages.map((m) => m.author)).toEqual(['VENDOR', 'VENDOR']);
  });
  it('refuses while the limit is unset, over the limit, and with a bad body', async () => {
    await expect(make({ ticketCreatePerHour: null }).svc.create('v1', A, { subject: 'abc', body: 'x' })).rejects.toMatchObject({ response: { code: 'TICKET_NOT_CONFIGURED' } });
    const { svc } = make(); for (let i = 0; i < 3; i++) await svc.create('v1', A, { subject: `Subject ${i}`, body: 'x' });
    await expect(svc.create('v1', A, { subject: 'Another', body: 'x' })).rejects.toMatchObject({ response: { code: 'TICKET_RATE_LIMITED' } });
    await expect(make().svc.create('v1', A, { subject: '', body: '' })).rejects.toMatchObject({ response: { code: 'TICKET_INVALID' } });
  });
  it('another business cannot read or reply on the ticket, and sees none of it in its list', async () => {
    const { svc } = make(); const t = await svc.create('v1', A, { subject: 'Private matter', body: 'x' });
    await expect(svc.get('v2', t.id)).rejects.toMatchObject({ response: { code: 'TICKET_NOT_FOUND' } }); await expect(svc.reply('v2', A, t.id, { body: 'hi' })).rejects.toMatchObject({ response: { code: 'TICKET_NOT_FOUND' } });
    expect((await svc.list('v2', 1, 20)).total).toBe(0);
  });
  it('an attachment must be a picture of this business', async () => {
    const { svc } = make(); await expect(svc.create('v1', A, { subject: 'With file', body: 'x', attachmentPictureId: 'pic-of-someone-else' })).rejects.toMatchObject({ response: { code: 'TICKET_ATTACHMENT_INVALID' } });
    expect((await svc.create('v1', A, { subject: 'With file', body: 'x', attachmentPictureId: 'pic1' })).messages[0].attachmentPictureId).toBe('pic1');
  });
});

describe('support tickets: staff', () => {
  it('lists every ticket, replies (the business is told, the text stays in the app), assigns and sets the status', async () => {
    const { svc, notifier, store } = make(); const t = await svc.create('v1', A, { subject: 'Site is slow', body: 'x' });
    const r = await svc.adminReply(STAFF, t.id, { body: 'We are looking at it' }); expect(r.status).toBe('WAITING_VENDOR'); expect(r.message.author).toBe('STAFF');
    expect(notifier.calls).toEqual([{ requesterType: 'VENDOR', vendorId: 'v1', requesterEmail: null, subject: 'Site is slow', replyBody: 'We are looking at it' }]);
    expect((await svc.adminAssign(STAFF, t.id, 's2')).assignedToStaffId).toBe('s2'); expect((await svc.adminAssign(STAFF, t.id, null)).assignedToStaffId).toBeNull();
    expect((await svc.adminList({ status: 'WAITING_VENDOR' }, 1, 20)).total).toBe(1); expect((await svc.adminList({ vendorId: 'v9' }, 1, 20)).total).toBe(0);
    await svc.reply('v1', A, t.id, { body: 'thanks' }); expect(store.tickets[0].status).toBe('OPEN');
    expect((await svc.adminSetStatus(STAFF, t.id, 'RESOLVED', 'OPEN')).status).toBe('RESOLVED');
  });
  it('a stale status change is refused, a bad one too, and an unknown ticket is not found', async () => {
    const { svc } = make(); const t = await svc.create('v1', A, { subject: 'Question here', body: 'x' });
    await svc.adminSetStatus(STAFF, t.id, 'IN_PROGRESS');
    await expect(svc.adminSetStatus(STAFF, t.id, 'RESOLVED', 'OPEN')).rejects.toMatchObject({ response: { code: 'TICKET_STATE_CHANGED' } });
    await expect(svc.adminSetStatus(STAFF, t.id, 'DONE')).rejects.toMatchObject({ response: { code: 'TICKET_INVALID' } });
    await expect(svc.adminSetStatus(STAFF, 'nope', 'RESOLVED')).rejects.toMatchObject({ response: { code: 'TICKET_NOT_FOUND' } });
    await expect(svc.adminReply(STAFF, 'nope', { body: 'x' })).rejects.toMatchObject({ response: { code: 'TICKET_NOT_FOUND' } });
  });
});

describe('support tickets: a visitor (public form)', () => {
  it('is off until the limit is set; then opens a customer ticket about the business, limited per address', async () => {
    await expect(make({ ticketPublicPerHour: null }).svc.createPublic({ email: 'c@example.com', subject: 'Order issue', body: 'x' })).rejects.toMatchObject({ response: { code: 'TICKET_NOT_CONFIGURED' } });
    const { svc, store } = make(); const r = await svc.createPublic({ subdomain: 'acme', name: 'Meena', email: 'C@Example.com', subject: 'Order issue', body: 'Where is it?' });
    expect(r.received).toBe(true); expect(store.tickets[0]).toMatchObject({ requesterType: 'CUSTOMER', vendorId: 'v1', requesterEmail: 'c@example.com' });
    await svc.createPublic({ email: 'c@example.com', subject: 'Second one', body: 'x' });
    await expect(svc.createPublic({ email: 'c@example.com', subject: 'Third one', body: 'x' })).rejects.toMatchObject({ response: { code: 'TICKET_RATE_LIMITED' } });
    await expect(svc.createPublic({ email: 'not-an-email', subject: 'Order issue', body: 'x' })).rejects.toMatchObject({ response: { code: 'TICKET_INVALID' } });
  });
  it('a customer ticket never shows in a business\'s own list, and staff replies go to the visitor address with the reply text', async () => {
    const { svc, notifier } = make(); const r = await svc.createPublic({ subdomain: 'acme', email: 'c@example.com', subject: 'Order issue', body: 'x' });
    expect((await svc.list('v1', 1, 20)).total).toBe(0); await expect(svc.get('v1', r.id)).rejects.toMatchObject({ response: { code: 'TICKET_NOT_FOUND' } });
    await svc.adminReply(STAFF, r.id, { body: 'Here is the answer' }); expect(notifier.calls[0]).toMatchObject({ requesterType: 'CUSTOMER', vendorId: 'v1', requesterEmail: 'c@example.com', replyBody: 'Here is the answer' });
  });
});

describe('ticket notices', () => {
  it('a business is told by a pointer to the app; a visitor gets the reply text at their own address, even when the ticket names a business', async () => {
    const { EmailTicketNotifier } = await import('../src/v3-support/support.service');
    const { FakeEmailTransport, GuardedEmailPort } = await import('../src/v3-mail/email.port');
    const { DEFAULT_MAIL_SETTINGS } = await import('../src/v3-mail/settings/mail-settings');
    const store = new MemorySupportStore(); store.emails.set('v1', 'owner@a.example');
    const transport = new FakeEmailTransport(); const email = new GuardedEmailPort(transport, { get: async () => ({ ...DEFAULT_MAIL_SETTINGS, mailSystemFromAddress: 'no-reply@send.example.com', mailSystemFromName: 'Get4Domain' }) } as never, () => ({ EMAIL_LIVE_SEND: 'true' }));
    const n = new EmailTicketNotifier(email, store);
    await n.staffReplied({ requesterType: 'VENDOR', vendorId: 'v1', requesterEmail: null, subject: 'Site slow', replyBody: 'secret details' });
    expect(transport.sent[0].m).toMatchObject({ kind: 'ACCOUNT_NOTICE', to: 'owner@a.example' }); expect(transport.sent[0].m.text).not.toContain('secret details');
    await n.staffReplied({ requesterType: 'CUSTOMER', vendorId: 'v1', requesterEmail: 'visitor@example.com', subject: 'Order', replyBody: 'Here is the answer' });
    expect(transport.sent[1].m).toMatchObject({ to: 'visitor@example.com' }); expect(transport.sent[1].m.text).toContain('Here is the answer');
  });
  it('a notice that cannot be sent (flag OFF) never fails the staff reply', async () => {
    const { EmailTicketNotifier } = await import('../src/v3-support/support.service');
    const { FakeEmailTransport, GuardedEmailPort } = await import('../src/v3-mail/email.port');
    const { DEFAULT_MAIL_SETTINGS } = await import('../src/v3-mail/settings/mail-settings');
    const store = new MemorySupportStore(); store.emails.set('v1', 'owner@a.example');
    const email = new GuardedEmailPort(new FakeEmailTransport(), { get: async () => DEFAULT_MAIL_SETTINGS } as never, () => ({}));
    await expect(new EmailTicketNotifier(email, store).staffReplied({ requesterType: 'VENDOR', vendorId: 'v1', requesterEmail: null, subject: 's', replyBody: 'b' })).resolves.toBeUndefined();
  });
});
