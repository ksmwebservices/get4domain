import { Injectable } from '@nestjs/common';
import { KeyedQueue } from '../common/keyed-queue';
import { parseRange } from '../v3-accounts/core/accounts-core';
import { CustomerCapture } from '../v3-business/customer-capture';
import { normalisePhone } from '../v3-customers/core/customer-core';
import { apptError } from './appointments.errors';
import { AppointmentsStore, BookingRow, ProviderRow, ServiceRow } from './appointments.store';
import { ApptState, canApptMove, checkHours, checkServiceInput, dayOfStart, freeSlots, isApptState } from './core/appointments-core';

/**
 * Schedules a reminder for a confirmed appointment. The automations engine and any sending arrive in Stage 17B; here the port exists and a fake records the call, so confirming an
 * appointment already hands the reminder to the right place. The lead time is not decided here: it is the automation's setting.
 */
export abstract class ReminderPort { abstract schedule(vendorId: string, bookingId: string, startsAtMs: number): Promise<void> }
export { CustomerCapture };

export interface BookingInput { serviceId?: unknown; providerId?: unknown; startsAt?: unknown; customerName?: unknown; customerPhone?: unknown; notes?: unknown; requestId?: unknown }

const slotQueue = new KeyedQueue();
const DAY_MS = 86_400_000;
const notFound = (what: string) => apptError(404, 'APPT_NOT_FOUND', `That ${what} was not found.`);
const stateError = (m: string) => apptError(409, 'APPT_STATE', m);
const serviceView = (s: ServiceRow) => ({ id: s.id, name: s.name, durationMin: s.durationMin, pricePaise: s.pricePaise, archived: s.archivedAt !== null });
const providerView = (p: ProviderRow) => ({ id: p.id, name: p.name, hours: p.hours, archived: p.archivedAt !== null });
const bookingView = (b: BookingRow) => ({ id: b.id, serviceId: b.serviceId, providerId: b.providerId, customerId: b.customerId, customerName: b.customerName, customerPhone: b.customerPhone, notes: b.notes, startsAt: b.startsAt, endsAt: b.endsAt, status: b.status, cancelReason: b.cancelReason, decidedAt: b.decidedAt, createdAt: b.createdAt });

/**
 * Appointments of a Professional business (slice 5.24b): services, providers with working hours, free slots, and request-and-confirm. The plan gate is the route's `@RequiresFeature`.
 * A request is REQUESTED and holds its slot; nothing in this class confirms an appointment except the business's own `confirm` call. Taking a slot runs one at a time per provider (before any
 * query), so two requests for the same time can never both succeed.
 */
@Injectable()
export class AppointmentsService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: AppointmentsStore, private readonly reminders: ReminderPort, private readonly customers: CustomerCapture) {}

  // ── services ──
  async createService(vendorId: string, i: { name?: unknown; durationMin?: unknown; pricePaise?: unknown }) {
    const c = checkServiceInput(i); if (!c.ok) throw apptError(400, 'APPT_INVALID', c.problems.join('; '));
    return serviceView(await this.store.addService(vendorId, c.value));
  }
  async listServices(vendorId: string, includeArchived: boolean, page: number, pageSize: number) { const r = await this.store.listServices(vendorId, includeArchived, { skip: (page - 1) * pageSize, take: pageSize }); return { items: r.items.map(serviceView), total: r.total }; }
  async updateService(vendorId: string, id: string, p: { name?: unknown; durationMin?: unknown; pricePaise?: unknown }) {
    const cur = await this.store.getService(vendorId, id); if (!cur) throw notFound('service');
    const c = checkServiceInput({ name: p.name ?? cur.name, durationMin: p.durationMin ?? cur.durationMin, pricePaise: p.pricePaise === undefined ? cur.pricePaise : p.pricePaise });
    if (!c.ok) throw apptError(400, 'APPT_INVALID', c.problems.join('; '));
    const row = await this.store.updateService(vendorId, id, c.value); if (!row) throw notFound('service'); return serviceView(row);
  }
  async archiveService(vendorId: string, id: string, archived: boolean) { const row = await this.store.updateService(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!row) throw notFound('service'); return serviceView(row); }

  // ── providers ──
  async createProvider(vendorId: string, i: { name?: unknown; hours?: unknown }) {
    const name = typeof i.name === 'string' ? i.name.trim().replace(/\s+/g, ' ') : ''; if (name.length < 1 || name.length > 120) throw apptError(400, 'APPT_INVALID', 'name: 1 to 120 characters');
    const h = checkHours(i.hours ?? []); if (!h.ok) throw apptError(400, 'APPT_INVALID', h.problems.join('; '));
    return providerView(await this.store.addProvider(vendorId, name, h.value));
  }
  async listProviders(vendorId: string, includeArchived: boolean, page: number, pageSize: number) { const r = await this.store.listProviders(vendorId, includeArchived, { skip: (page - 1) * pageSize, take: pageSize }); return { items: r.items.map(providerView), total: r.total }; }
  async updateProvider(vendorId: string, id: string, p: { name?: unknown; hours?: unknown }) {
    const cur = await this.store.getProvider(vendorId, id); if (!cur) throw notFound('provider');
    const patch: { name?: string; hours?: ProviderRow['hours'] } = {};
    if (p.name !== undefined) { const name = typeof p.name === 'string' ? p.name.trim().replace(/\s+/g, ' ') : ''; if (name.length < 1 || name.length > 120) throw apptError(400, 'APPT_INVALID', 'name: 1 to 120 characters'); patch.name = name; }
    if (p.hours !== undefined) { const h = checkHours(p.hours); if (!h.ok) throw apptError(400, 'APPT_INVALID', h.problems.join('; ')); patch.hours = h.value; }
    const row = await this.store.updateProvider(vendorId, id, patch); if (!row) throw notFound('provider'); return providerView(row);
  }
  async archiveProvider(vendorId: string, id: string, archived: boolean) { const row = await this.store.updateProvider(vendorId, id, { archivedAt: archived ? this.clock() : null }); if (!row) throw notFound('provider'); return providerView(row); }

  // ── slots and requests ──
  private async pair(vendorId: string, serviceId: unknown, providerId: unknown): Promise<{ service: ServiceRow; provider: ProviderRow }> {
    const service = typeof serviceId === 'string' ? await this.store.getService(vendorId, serviceId) : null; const provider = typeof providerId === 'string' ? await this.store.getProvider(vendorId, providerId) : null;
    if (!service || service.archivedAt) throw notFound('service'); if (!provider || provider.archivedAt) throw notFound('provider');
    return { service, provider };
  }
  private async slotsOn(vendorId: string, service: ServiceRow, provider: ProviderRow, day: string): Promise<number[]> {
    const t0 = Date.parse(`${day}T00:00:00+05:30`);
    const busy = await this.store.busy(vendorId, provider.id, new Date(t0), new Date(t0 + DAY_MS));
    return freeSlots({ hours: provider.hours, durationMin: service.durationMin, day, busy, nowMs: this.clock().getTime() });
  }
  async availability(vendorId: string, q: { serviceId: string; providerId: string; day: string }) {
    const { service, provider } = await this.pair(vendorId, q.serviceId, q.providerId);
    if (!parseRange(q.day, q.day).ok) throw apptError(400, 'APPT_INVALID', 'day: YYYY-MM-DD.');
    return { day: q.day, durationMin: service.durationMin, slots: (await this.slotsOn(vendorId, service, provider, q.day)).map((ms) => new Date(ms).toISOString()) };
  }

  /** A customer's request, entered by the business (phone, walk-in, or from an enquiry). Always REQUESTED: the business confirms. */
  async requestBooking(vendorId: string, i: BookingInput) {
    const customerName = typeof i.customerName === 'string' ? i.customerName.trim().replace(/\s+/g, ' ').slice(0, 120) : ''; if (!customerName) throw apptError(400, 'APPT_INVALID', 'customerName: 1 to 120 characters');
    const hasPhone = i.customerPhone !== undefined && i.customerPhone !== null && String(i.customerPhone).trim() !== '';
    if (hasPhone && !normalisePhone(i.customerPhone)) throw apptError(400, 'APPT_INVALID', 'customerPhone: not a phone number');
    const startMs = typeof i.startsAt === 'string' ? Date.parse(i.startsAt) : NaN; if (Number.isNaN(startMs)) throw apptError(400, 'APPT_INVALID', 'startsAt: a date and time, ISO 8601.');
    const { service, provider } = await this.pair(vendorId, i.serviceId, i.providerId);
    const row = await slotQueue.run(`slot:${vendorId}:${provider.id}`, async () => {
      if (!(await this.slotsOn(vendorId, service, provider, dayOfStart(startMs))).includes(startMs)) throw apptError(409, 'APPT_SLOT_UNAVAILABLE', 'That time is not free.');
      return this.store.createBooking(vendorId, { serviceId: service.id, providerId: provider.id, customerId: null, customerName, customerPhone: hasPhone ? String(i.customerPhone).trim().slice(0, 20) : null, notes: typeof i.notes === 'string' && i.notes.trim() ? i.notes.trim().slice(0, 1000) : null, startsAt: new Date(startMs), endsAt: new Date(startMs + service.durationMin * 60_000), requestId: typeof i.requestId === 'string' && i.requestId ? i.requestId.slice(0, 40) : null });
    });
    let out = row;
    if (hasPhone) { const customerId = await this.customers.capture(vendorId, { name: customerName, phone: String(i.customerPhone).trim(), refType: 'appointment', refId: row.id }); if (customerId) { await this.store.setBookingCustomer(vendorId, row.id, customerId); out = { ...row, customerId }; } }
    return bookingView(out);
  }

  async listBookings(vendorId: string, q: { status?: string; providerId?: string; from?: string; to?: string }, page: number, pageSize: number) {
    if (q.status !== undefined && !isApptState(q.status)) throw apptError(400, 'APPT_INVALID', 'status: not an appointment state.');
    let from: Date | undefined; let to: Date | undefined;
    if (q.from !== undefined || q.to !== undefined) { const r = parseRange(q.from, q.to); if (!r.ok) throw apptError(400, 'APPT_INVALID', 'from and to: two days, YYYY-MM-DD, at most one year apart.'); from = new Date(r.fromMs); to = new Date(r.toMs); }
    const r = await this.store.listBookings(vendorId, { status: q.status, providerId: q.providerId, from, to }, { skip: (page - 1) * pageSize, take: pageSize });
    return { items: r.items.map(bookingView), total: r.total };
  }
  async getBooking(vendorId: string, id: string) { const b = await this.store.getBooking(vendorId, id); if (!b) throw notFound('appointment'); return bookingView(b); }

  private async move(vendorId: string, id: string, to: ApptState, reason?: string): Promise<BookingRow> {
    const cur = await this.store.getBooking(vendorId, id); if (!cur) throw notFound('appointment');
    if (!canApptMove(cur.status, to)) throw stateError(`An appointment that is ${cur.status} cannot become ${to}.`);
    const row = await this.store.moveBooking(vendorId, id, cur.status, to, to === 'CANCELLED' ? { cancelReason: reason?.trim().slice(0, 300) || null } : {}, this.clock());
    if (!row) throw stateError('That appointment changed while you were working on it. Open it again.');
    return row;
  }
  /** The only place an appointment becomes CONFIRMED, and only by the business's own call. */
  async confirm(vendorId: string, id: string) { const row = await this.move(vendorId, id, 'CONFIRMED'); await this.reminders.schedule(vendorId, row.id, row.startsAt.getTime()); return bookingView(row); }
  async decline(vendorId: string, id: string) { return bookingView(await this.move(vendorId, id, 'DECLINED')); }
  async cancel(vendorId: string, id: string, reason?: string) { return bookingView(await this.move(vendorId, id, 'CANCELLED', reason)); }
  async complete(vendorId: string, id: string) { return bookingView(await this.move(vendorId, id, 'COMPLETED')); }
  async noShow(vendorId: string, id: string) { return bookingView(await this.move(vendorId, id, 'NO_SHOW')); }
}
