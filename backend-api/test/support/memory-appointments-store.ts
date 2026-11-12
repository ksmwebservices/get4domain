import { ApptState, HOLDING_STATES, HoursWindow, Interval, ServiceFields } from '../../src/v3-appointments/core/appointments-core';
import { AppointmentsStore, BookingRow, NewBooking, Paging, ProviderRow, ServiceRow } from '../../src/v3-appointments/appointments.store';

const clean = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** In-memory twin of the appointments store: same vendor scoping and compare-and-set moves. */
export class MemoryAppointmentsStore extends AppointmentsStore {
  services: ServiceRow[] = []; providers: ProviderRow[] = []; bookings: BookingRow[] = []; private n = 0;
  async addService(vendorId: string, s: ServiceFields) { const r: ServiceRow = { ...s, id: `s${++this.n}`, vendorId, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }; this.services.push(r); return { ...r }; }
  async listServices(vendorId: string, includeArchived: boolean, p: Paging) { const all = this.services.filter((x) => x.vendorId === vendorId && (includeArchived || !x.archivedAt)); return { items: all.slice(p.skip, p.skip + p.take).map((r) => ({ ...r })), total: all.length }; }
  async getService(vendorId: string, id: string) { const r = this.services.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async updateService(vendorId: string, id: string, patch: Partial<ServiceFields> & { archivedAt?: Date | null }) { const r = this.services.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null; Object.assign(r, clean(patch), { updatedAt: new Date() }); return { ...r }; }
  async addProvider(vendorId: string, name: string, hours: HoursWindow[]) { const r: ProviderRow = { id: `p${++this.n}`, vendorId, name, hours, archivedAt: null, createdAt: new Date(), updatedAt: new Date() }; this.providers.push(r); return { ...r }; }
  async listProviders(vendorId: string, includeArchived: boolean, p: Paging) { const all = this.providers.filter((x) => x.vendorId === vendorId && (includeArchived || !x.archivedAt)); return { items: all.slice(p.skip, p.skip + p.take).map((r) => ({ ...r })), total: all.length }; }
  async getProvider(vendorId: string, id: string) { const r = this.providers.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async updateProvider(vendorId: string, id: string, patch: { name?: string; hours?: HoursWindow[]; archivedAt?: Date | null }) { const r = this.providers.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null; Object.assign(r, clean(patch), { updatedAt: new Date() }); return { ...r }; }
  async createBooking(vendorId: string, b: NewBooking) { const r: BookingRow = { ...b, id: `b${++this.n}`, vendorId, status: 'REQUESTED', cancelReason: null, decidedAt: null, createdAt: new Date(), updatedAt: new Date() }; this.bookings.push(r); return { ...r }; }
  async getBooking(vendorId: string, id: string) { const r = this.bookings.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; }
  async listBookings(vendorId: string, q: { status?: string; providerId?: string; from?: Date; to?: Date }, p: Paging) {
    const all = this.bookings.filter((x) => x.vendorId === vendorId && (!q.status || x.status === q.status) && (!q.providerId || x.providerId === q.providerId) && (!q.from || x.startsAt >= q.from) && (!q.to || x.startsAt < q.to)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return { items: all.slice(p.skip, p.skip + p.take).map((r) => ({ ...r })), total: all.length };
  }
  async moveBooking(vendorId: string, id: string, from: ApptState, to: ApptState, extra: { cancelReason?: string | null }, at: Date) {
    const r = this.bookings.find((x) => x.id === id && x.vendorId === vendorId && x.status === from); if (!r) return null; Object.assign(r, clean(extra), { status: to, decidedAt: at, updatedAt: new Date() }); return { ...r };
  }
  async setBookingCustomer(vendorId: string, id: string, customerId: string) { const r = this.bookings.find((x) => x.id === id && x.vendorId === vendorId); if (r) r.customerId = customerId; }
  async busy(vendorId: string, providerId: string, from: Date, to: Date): Promise<Interval[]> {
    return this.bookings.filter((x) => x.vendorId === vendorId && x.providerId === providerId && (HOLDING_STATES as readonly string[]).includes(x.status) && x.startsAt < to && x.endsAt > from).map((x) => ({ startMs: x.startsAt.getTime(), endMs: x.endsAt.getTime() }));
  }
}
