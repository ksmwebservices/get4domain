import { AppointmentsService, ReminderPort } from '../src/v3-appointments/appointments.service';
import { CustomerCapture } from '../src/v3-business/customer-capture';
import { MemoryAppointmentsStore } from './support/memory-appointments-store';

const A = 'vendor-a'; const B = 'vendor-b'; const MON = '2026-11-16';
const at = (hm: string): string => new Date(Date.parse(`${MON}T${hm}:00+05:30`)).toISOString();
class Reminders extends ReminderPort { scheduled: Array<{ vendorId: string; bookingId: string }> = []; async schedule(vendorId: string, bookingId: string) { this.scheduled.push({ vendorId, bookingId }); } }
class Cust extends CustomerCapture { seen = 0; async capture() { this.seen++; return 'cust-1'; } }
const code = (c: string) => ({ response: { code: c } });
const hours = [{ day: 1, start: '09:00', end: '11:00' }];

async function world() {
  const store = new MemoryAppointmentsStore(); const reminders = new Reminders(); const cust = new Cust(); const svc = new AppointmentsService(store, reminders, cust); svc.clock = () => new Date('2026-11-10T00:00:00Z');
  const s30 = await svc.createService(A, { name: 'Consultation', durationMin: 30 }); const s60 = await svc.createService(A, { name: 'Long session', durationMin: 60 }); const p = await svc.createProvider(A, { name: 'Dr Rao', hours });
  return { store, reminders, cust, svc, s30, s60, p };
}
const ask = (w: Awaited<ReturnType<typeof world>>, hm: string, o: { serviceId?: string; vendor?: string; phone?: string } = {}) => w.svc.requestBooking(o.vendor ?? A, { serviceId: o.serviceId ?? w.s30.id, providerId: w.p.id, startsAt: at(hm), customerName: 'Meena', customerPhone: o.phone });

describe('services and providers', () => {
  it('are added, changed and archived, never deleted; bad input is refused with the stable code', async () => {
    const { svc, store, s30, p } = await world();
    expect((await svc.updateService(A, s30.id, { durationMin: 45 })).durationMin).toBe(45); expect((await svc.archiveService(A, s30.id, true)).archived).toBe(true); expect(store.services).toHaveLength(2);
    expect((await svc.updateProvider(A, p.id, { hours: [{ day: 2, start: '10:00', end: '12:00' }] })).hours).toHaveLength(1);
    await expect(svc.createService(A, { name: '', durationMin: 7 })).rejects.toMatchObject(code('APPT_INVALID'));
    await expect(svc.createProvider(A, { name: 'X', hours: [{ day: 1, start: '12:00', end: '09:00' }] })).rejects.toMatchObject(code('APPT_INVALID'));
    await expect(svc.createProvider(A, { name: ' ', hours: [] })).rejects.toMatchObject(code('APPT_INVALID'));
  });
  it('another business sees nothing and changes nothing', async () => {
    const w = await world(); const b = await ask(w, '09:00');
    expect((await w.svc.listServices(B, false, 1, 20)).total).toBe(0); expect((await w.svc.listProviders(B, false, 1, 20)).total).toBe(0); expect((await w.svc.listBookings(B, {}, 1, 20)).total).toBe(0);
    for (const call of [() => w.svc.updateService(B, w.s30.id, { name: 'x' }), () => w.svc.archiveService(B, w.s30.id, true), () => w.svc.updateProvider(B, w.p.id, { name: 'x' }), () => w.svc.archiveProvider(B, w.p.id, true), () => w.svc.getBooking(B, b.id), () => w.svc.confirm(B, b.id), () => w.svc.decline(B, b.id), () => w.svc.cancel(B, b.id), () => w.svc.availability(B, { serviceId: w.s30.id, providerId: w.p.id, day: MON }), () => ask(w, '10:00', { vendor: B })]) await expect(call()).rejects.toMatchObject(code('APPT_NOT_FOUND'));
  });
});

describe('free slots and requests', () => {
  it('lists the slots of a provider for a service on a day', async () => {
    const w = await world(); const r = await w.svc.availability(A, { serviceId: w.s30.id, providerId: w.p.id, day: MON });
    expect(r.slots).toEqual(['09:00', '09:30', '10:00', '10:30'].map(at));
  });
  it('a request is REQUESTED, holds its slot, and is never confirmed by itself (no reminder is scheduled either)', async () => {
    const w = await world(); const b = await ask(w, '09:00');
    expect(b.status).toBe('REQUESTED'); expect((await w.svc.availability(A, { serviceId: w.s30.id, providerId: w.p.id, day: MON })).slots).not.toContain(at('09:00'));
    expect(w.reminders.scheduled).toEqual([]); expect(w.store.bookings.every((x) => x.status === 'REQUESTED')).toBe(true);
  });
  it('the same slot cannot be asked for twice, and ten parallel requests for it leave exactly one', async () => {
    const w = await world(); await ask(w, '09:00'); await expect(ask(w, '09:00')).rejects.toMatchObject(code('APPT_SLOT_UNAVAILABLE'));
    const r = await Promise.allSettled(Array.from({ length: 10 }, () => ask(w, '10:00'))); expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1); expect(w.store.bookings.filter((x) => x.startsAt.toISOString() === at('10:00'))).toHaveLength(1);
  });
  it('a longer service that would run into a held time is refused, and one that ends exactly where it starts is allowed', async () => {
    const w = await world(); await ask(w, '09:30');
    await expect(ask(w, '09:00', { serviceId: w.s60.id })).rejects.toMatchObject(code('APPT_SLOT_UNAVAILABLE'));
    expect((await ask(w, '09:00')).status).toBe('REQUESTED');
  });
  it.each([['08:00'], ['09:10'], ['11:00'], ['23:00']])('a time outside the hours or off the grid (%s) is refused', async (hm) => { const w = await world(); await expect(ask(w, hm)).rejects.toMatchObject(code('APPT_SLOT_UNAVAILABLE')); });
  it('a time in the past, an archived service and a missing provider are refused', async () => {
    const w = await world(); w.svc.clock = () => new Date('2026-11-16T04:00:00Z'); await expect(ask(w, '09:00')).rejects.toMatchObject(code('APPT_SLOT_UNAVAILABLE'));
    w.svc.clock = () => new Date('2026-11-10T00:00:00Z'); await w.svc.archiveService(A, w.s30.id, true); await expect(ask(w, '10:00')).rejects.toMatchObject(code('APPT_NOT_FOUND'));
    await expect(w.svc.requestBooking(A, { serviceId: w.s60.id, providerId: 'nope', startsAt: at('10:00'), customerName: 'M' })).rejects.toMatchObject(code('APPT_NOT_FOUND'));
  });
  it('needs a name, and a phone it can read when one is given; a good phone puts the person on the customer list', async () => {
    const w = await world(); await expect(w.svc.requestBooking(A, { serviceId: w.s30.id, providerId: w.p.id, startsAt: at('09:00'), customerName: '' })).rejects.toMatchObject(code('APPT_INVALID'));
    await expect(ask(w, '09:00', { phone: 'abc' })).rejects.toMatchObject(code('APPT_INVALID'));
    const b = await ask(w, '09:00', { phone: '98765 43210' }); expect(b.customerId).toBe('cust-1'); expect(w.cust.seen).toBe(1);
  });
});

describe('the business decides', () => {
  it('confirm moves REQUESTED to CONFIRMED once and schedules the reminder once', async () => {
    const w = await world(); const b = await ask(w, '09:00'); const c = await w.svc.confirm(A, b.id);
    expect(c.status).toBe('CONFIRMED'); expect(w.reminders.scheduled).toEqual([{ vendorId: A, bookingId: b.id }]);
    await expect(w.svc.confirm(A, b.id)).rejects.toMatchObject(code('APPT_STATE')); expect(w.reminders.scheduled).toHaveLength(1);
  });
  it('ten parallel confirms leave one winner and one reminder', async () => {
    const w = await world(); const b = await ask(w, '09:00'); const r = await Promise.allSettled(Array.from({ length: 10 }, () => w.svc.confirm(A, b.id)));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1); expect(w.reminders.scheduled).toHaveLength(1);
  });
  it('decline and cancel give the slot back; the reason is kept', async () => {
    const w = await world(); const a = await ask(w, '09:00'); const b = await ask(w, '09:30');
    expect((await w.svc.decline(A, a.id)).status).toBe('DECLINED'); expect((await w.svc.cancel(A, b.id, 'customer rang')).cancelReason).toBe('customer rang');
    expect((await w.svc.availability(A, { serviceId: w.s30.id, providerId: w.p.id, day: MON })).slots).toEqual(['09:00', '09:30', '10:00', '10:30'].map(at));
    expect(w.store.bookings).toHaveLength(2);
  });
  it('complete and no-show need a confirmed appointment; a finished one is final', async () => {
    const w = await world(); const b = await ask(w, '09:00');
    await expect(w.svc.complete(A, b.id)).rejects.toMatchObject(code('APPT_STATE')); await expect(w.svc.noShow(A, b.id)).rejects.toMatchObject(code('APPT_STATE'));
    await w.svc.confirm(A, b.id); expect((await w.svc.complete(A, b.id)).status).toBe('COMPLETED'); await expect(w.svc.cancel(A, b.id)).rejects.toMatchObject(code('APPT_STATE'));
  });
  it('lists by status, provider and day range', async () => {
    const w = await world(); const b = await ask(w, '09:00'); await ask(w, '10:00'); await w.svc.confirm(A, b.id);
    expect((await w.svc.listBookings(A, { status: 'CONFIRMED' }, 1, 20)).total).toBe(1); expect((await w.svc.listBookings(A, { from: MON, to: MON }, 1, 20)).total).toBe(2); expect((await w.svc.listBookings(A, { from: '2026-11-17', to: '2026-11-17' }, 1, 20)).total).toBe(0);
  });
});
