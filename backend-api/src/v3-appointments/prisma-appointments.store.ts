import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsStore, BookingRow, NewBooking, Paging, ProviderRow, ServiceRow } from './appointments.store';
import { ApptState, HOLDING_STATES, HoursWindow, Interval, ServiceFields } from './core/appointments-core';

type DbService = Prisma.V3ApptServiceGetPayload<Record<string, never>>;
type DbProvider = Prisma.V3ApptProviderGetPayload<Record<string, never>>;
type DbBooking = Prisma.V3ApptBookingGetPayload<Record<string, never>>;
const service = (r: DbService): ServiceRow => ({ id: r.id, vendorId: r.vendorId, name: r.name, durationMin: r.durationMin, pricePaise: r.pricePaise, archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const provider = (r: DbProvider): ProviderRow => ({ id: r.id, vendorId: r.vendorId, name: r.name, hours: (Array.isArray(r.hoursJson) ? r.hoursJson : []) as unknown as HoursWindow[], archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const booking = (r: DbBooking): BookingRow => ({ id: r.id, vendorId: r.vendorId, serviceId: r.serviceId, providerId: r.providerId, customerId: r.customerId, customerName: r.customerName, customerPhone: r.customerPhone, notes: r.notes, startsAt: r.startsAt, endsAt: r.endsAt, status: r.status as ApptState, requestId: r.requestId, cancelReason: r.cancelReason, decidedAt: r.decidedAt, createdAt: r.createdAt, updatedAt: r.updatedAt });
const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

@Injectable()
export class PrismaAppointmentsStore extends AppointmentsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async addService(vendorId: string, s: ServiceFields): Promise<ServiceRow> { return service(await this.prisma.v3ApptService.create({ data: { vendorId, name: s.name, durationMin: s.durationMin, pricePaise: s.pricePaise } })); }
  async listServices(vendorId: string, includeArchived: boolean, p: Paging): Promise<{ items: ServiceRow[]; total: number }> {
    const rest: Prisma.V3ApptServiceWhereInput = includeArchived ? {} : { archivedAt: null };
    const [items, total] = await Promise.all([this.prisma.v3ApptService.findMany({ where: { vendorId, ...rest }, orderBy: { createdAt: 'asc' }, skip: p.skip, take: p.take }), this.prisma.v3ApptService.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(service), total };
  }
  async getService(vendorId: string, id: string): Promise<ServiceRow | null> { const r = await this.prisma.v3ApptService.findFirst({ where: { id, vendorId } }); return r ? service(r) : null; }
  async updateService(vendorId: string, id: string, patch: Partial<ServiceFields> & { archivedAt?: Date | null }): Promise<ServiceRow | null> {
    const n = await this.prisma.v3ApptService.updateMany({ where: { id, vendorId }, data: defined(patch) });
    return n.count === 0 ? null : this.getService(vendorId, id);
  }

  async addProvider(vendorId: string, name: string, hours: HoursWindow[]): Promise<ProviderRow> { return provider(await this.prisma.v3ApptProvider.create({ data: { vendorId, name, hoursJson: hours as unknown as Prisma.InputJsonValue } })); }
  async listProviders(vendorId: string, includeArchived: boolean, p: Paging): Promise<{ items: ProviderRow[]; total: number }> {
    const rest: Prisma.V3ApptProviderWhereInput = includeArchived ? {} : { archivedAt: null };
    const [items, total] = await Promise.all([this.prisma.v3ApptProvider.findMany({ where: { vendorId, ...rest }, orderBy: { createdAt: 'asc' }, skip: p.skip, take: p.take }), this.prisma.v3ApptProvider.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(provider), total };
  }
  async getProvider(vendorId: string, id: string): Promise<ProviderRow | null> { const r = await this.prisma.v3ApptProvider.findFirst({ where: { id, vendorId } }); return r ? provider(r) : null; }
  async updateProvider(vendorId: string, id: string, patch: { name?: string; hours?: HoursWindow[]; archivedAt?: Date | null }): Promise<ProviderRow | null> {
    const { hours, ...rest } = patch;
    const n = await this.prisma.v3ApptProvider.updateMany({ where: { id, vendorId }, data: { ...defined(rest), ...(hours ? { hoursJson: hours as unknown as Prisma.InputJsonValue } : {}) } });
    return n.count === 0 ? null : this.getProvider(vendorId, id);
  }

  async createBooking(vendorId: string, b: NewBooking): Promise<BookingRow> { return booking(await this.prisma.v3ApptBooking.create({ data: { vendorId, ...b } })); }
  async getBooking(vendorId: string, id: string): Promise<BookingRow | null> { const r = await this.prisma.v3ApptBooking.findFirst({ where: { id, vendorId } }); return r ? booking(r) : null; }
  async listBookings(vendorId: string, q: { status?: string; providerId?: string; from?: Date; to?: Date }, p: Paging): Promise<{ items: BookingRow[]; total: number }> {
    const rest: Prisma.V3ApptBookingWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.providerId ? { providerId: q.providerId } : {}), ...(q.from || q.to ? { startsAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3ApptBooking.findMany({ where: { vendorId, ...rest }, orderBy: { startsAt: 'asc' }, skip: p.skip, take: p.take }), this.prisma.v3ApptBooking.count({ where: { vendorId, ...rest } })]);
    return { items: items.map(booking), total };
  }
  async moveBooking(vendorId: string, id: string, from: ApptState, to: ApptState, extra: { cancelReason?: string | null }, at: Date): Promise<BookingRow | null> {
    const n = await this.prisma.v3ApptBooking.updateMany({ where: { id, vendorId, status: from }, data: { ...defined(extra), status: to, decidedAt: at } });   // one conditional statement: only one caller can win
    return n.count === 0 ? null : this.getBooking(vendorId, id);
  }
  async setBookingCustomer(vendorId: string, id: string, customerId: string): Promise<void> { await this.prisma.v3ApptBooking.updateMany({ where: { id, vendorId }, data: { customerId } }); }
  async busy(vendorId: string, providerId: string, from: Date, to: Date): Promise<Interval[]> {
    const rows = await this.prisma.v3ApptBooking.findMany({ where: { vendorId, providerId, status: { in: [...HOLDING_STATES] }, startsAt: { lt: to }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true }, take: 500 });
    return rows.map((r) => ({ startMs: r.startsAt.getTime(), endMs: r.endsAt.getTime() }));
  }
}
