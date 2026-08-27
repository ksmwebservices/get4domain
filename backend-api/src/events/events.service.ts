import { Injectable, NotFoundException } from '@nestjs/common';
import { EventBooking, EventVendorAssignment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBookingDto, UpdateBookingDto,
  CreateEventVendorDto, UpdateEventVendorDto,
} from './dto/events.dto';

export interface EventsSummary {
  upcomingEvents: number;
  bookedValue: number;
  advanceCollected: number;
  vendorCostPending: number;
  byType: { type: string; count: number; value: number }[];
}

const ACTIVE = ['enquiry', 'confirmed', 'in_progress'];

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Bookings ──
  listBookings(vendorId: string): Promise<EventBooking[]> {
    return this.prisma.eventBooking.findMany({
      where: { vendorId },
      orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
      include: { vendors: { orderBy: { createdAt: 'asc' } } },
    });
  }
  getBooking(vendorId: string, id: string): Promise<EventBooking> {
    return this.ownBooking(vendorId, id, true);
  }
  createBooking(vendorId: string, dto: CreateBookingDto): Promise<EventBooking> {
    const { eventDate, ...rest } = dto;
    return this.prisma.eventBooking.create({
      data: { vendorId, ...rest, eventDate: eventDate ? new Date(eventDate) : undefined },
      include: { vendors: true },
    });
  }
  async updateBooking(vendorId: string, id: string, dto: UpdateBookingDto): Promise<EventBooking> {
    await this.ownBooking(vendorId, id);
    const { eventDate, ...rest } = dto;
    return this.prisma.eventBooking.update({
      where: { id },
      data: { ...rest, ...(eventDate !== undefined ? { eventDate: eventDate ? new Date(eventDate) : null } : {}) },
      include: { vendors: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async deleteBooking(vendorId: string, id: string): Promise<EventBooking> {
    await this.ownBooking(vendorId, id);
    return this.prisma.eventBooking.delete({ where: { id } });
  }

  // ── Vendor assignments ──
  listVendors(vendorId: string): Promise<EventVendorAssignment[]> {
    return this.prisma.eventVendorAssignment.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { booking: { select: { id: true, title: true, clientName: true, eventDate: true } } },
    });
  }
  async addVendor(vendorId: string, bookingId: string, dto: CreateEventVendorDto): Promise<EventVendorAssignment> {
    await this.ownBooking(vendorId, bookingId);
    return this.prisma.eventVendorAssignment.create({ data: { vendorId, bookingId, ...dto } });
  }
  async updateVendor(vendorId: string, id: string, dto: UpdateEventVendorDto): Promise<EventVendorAssignment> {
    await this.ownVendor(vendorId, id);
    return this.prisma.eventVendorAssignment.update({ where: { id }, data: dto });
  }
  async deleteVendor(vendorId: string, id: string): Promise<EventVendorAssignment> {
    await this.ownVendor(vendorId, id);
    return this.prisma.eventVendorAssignment.delete({ where: { id } });
  }

  /** Accounts depth: upcoming events, booked value vs advance, unpaid vendor cost, by type. */
  async summary(vendorId: string): Promise<EventsSummary> {
    const [bookings, vendorAgg] = await Promise.all([
      this.prisma.eventBooking.findMany({ where: { vendorId }, select: { status: true, eventType: true, packageValue: true, advancePaid: true } }),
      this.prisma.eventVendorAssignment.aggregate({ where: { vendorId, status: { not: 'paid' } }, _sum: { cost: true } }),
    ]);
    const active = bookings.filter((b) => ACTIVE.includes(b.status));
    const bookedValue = active.reduce((s, b) => s + b.packageValue, 0);
    const advanceCollected = active.reduce((s, b) => s + b.advancePaid, 0);
    const map = new Map<string, { count: number; value: number }>();
    for (const b of active) {
      const cur = map.get(b.eventType) ?? { count: 0, value: 0 };
      cur.count += 1; cur.value += b.packageValue;
      map.set(b.eventType, cur);
    }
    const byType = [...map.entries()].map(([type, v]) => ({ type, ...v }));
    return { upcomingEvents: active.length, bookedValue, advanceCollected, vendorCostPending: vendorAgg._sum.cost ?? 0, byType };
  }

  // ── Guards ──
  private async ownBooking(vendorId: string, id: string, withVendors = false): Promise<EventBooking> {
    const row = await this.prisma.eventBooking.findFirst({
      where: { id, vendorId },
      ...(withVendors ? { include: { vendors: { orderBy: { createdAt: 'asc' } } } } : {}),
    });
    if (!row) throw new NotFoundException('Booking not found');
    return row;
  }
  private async ownVendor(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.eventVendorAssignment.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Vendor assignment not found');
  }
}
