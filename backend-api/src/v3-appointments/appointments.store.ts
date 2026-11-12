import { ApptState, HoursWindow, Interval, ServiceFields } from './core/appointments-core';

export interface ServiceRow extends ServiceFields { id: string; vendorId: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface ProviderRow { id: string; vendorId: string; name: string; hours: HoursWindow[]; archivedAt: Date | null; createdAt: Date; updatedAt: Date }
export interface BookingRow {
  id: string; vendorId: string; serviceId: string; providerId: string; customerId: string | null; customerName: string; customerPhone: string | null; notes: string | null; startsAt: Date; endsAt: Date;
  status: ApptState; requestId: string | null; cancelReason: string | null; decidedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface NewBooking { serviceId: string; providerId: string; customerId: string | null; customerName: string; customerPhone: string | null; notes: string | null; startsAt: Date; endsAt: Date; requestId: string | null }
export interface Paging { skip: number; take: number }

/**
 * Everything appointments store, behind one port (Prisma implementation and an in-memory twin). Every read and write carries the vendor id in its WHERE. Status moves are compare-and-set
 * (`from` must still be the current state). `busy` returns the times that hold a slot (REQUESTED and CONFIRMED) so a free slot can be worked out.
 */
export abstract class AppointmentsStore {
  abstract addService(vendorId: string, s: ServiceFields): Promise<ServiceRow>;
  abstract listServices(vendorId: string, includeArchived: boolean, p: Paging): Promise<{ items: ServiceRow[]; total: number }>;
  abstract getService(vendorId: string, id: string): Promise<ServiceRow | null>;
  abstract updateService(vendorId: string, id: string, patch: Partial<ServiceFields> & { archivedAt?: Date | null }): Promise<ServiceRow | null>;
  abstract addProvider(vendorId: string, name: string, hours: HoursWindow[]): Promise<ProviderRow>;
  abstract listProviders(vendorId: string, includeArchived: boolean, p: Paging): Promise<{ items: ProviderRow[]; total: number }>;
  abstract getProvider(vendorId: string, id: string): Promise<ProviderRow | null>;
  abstract updateProvider(vendorId: string, id: string, patch: { name?: string; hours?: HoursWindow[]; archivedAt?: Date | null }): Promise<ProviderRow | null>;
  abstract createBooking(vendorId: string, b: NewBooking): Promise<BookingRow>;
  abstract getBooking(vendorId: string, id: string): Promise<BookingRow | null>;
  abstract listBookings(vendorId: string, q: { status?: string; providerId?: string; from?: Date; to?: Date }, p: Paging): Promise<{ items: BookingRow[]; total: number }>;
  abstract moveBooking(vendorId: string, id: string, from: ApptState, to: ApptState, extra: { cancelReason?: string | null }, at: Date): Promise<BookingRow | null>;
  abstract setBookingCustomer(vendorId: string, id: string, customerId: string): Promise<void>;
  abstract busy(vendorId: string, providerId: string, from: Date, to: Date): Promise<Interval[]>;
}
