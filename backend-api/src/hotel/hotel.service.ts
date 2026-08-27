import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Room, RoomBooking } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto, UpdateRoomDto, CreateRoomBookingDto, UpdateRoomBookingDto } from './dto/hotel.dto';

export interface HotelSummary {
  totalRooms: number;
  occupied: number;
  occupancyPct: number;
  needsCleaning: number;       // housekeeping != clean
  inHouse: number;             // bookings currently checked_in
  monthRevenue: number;        // checked_out bookings, this month
}

@Injectable()
export class HotelService {
  constructor(private readonly prisma: PrismaService) {}

  // Rooms
  listRooms(vendorId: string): Promise<Room[]> {
    return this.prisma.room.findMany({ where: { vendorId }, orderBy: { number: 'asc' } });
  }
  createRoom(vendorId: string, dto: CreateRoomDto): Promise<Room> {
    return this.prisma.room.create({ data: { vendorId, ...dto } });
  }
  async updateRoom(vendorId: string, id: string, dto: UpdateRoomDto): Promise<Room> {
    await this.ownRoom(vendorId, id);
    return this.prisma.room.update({ where: { id }, data: dto });
  }
  async deleteRoom(vendorId: string, id: string): Promise<Room> {
    await this.ownRoom(vendorId, id);
    return this.prisma.room.delete({ where: { id } });
  }

  // Bookings
  listBookings(vendorId: string): Promise<RoomBooking[]> {
    return this.prisma.roomBooking.findMany({
      where: { vendorId }, orderBy: { checkIn: 'desc' },
      include: { room: { select: { id: true, number: true, roomType: true } } },
    });
  }
  async createBooking(vendorId: string, dto: CreateRoomBookingDto): Promise<RoomBooking> {
    await this.assertRoom(vendorId, dto.roomId);
    const { checkIn, checkOut, ...rest } = dto;
    return this.prisma.roomBooking.create({ data: { vendorId, ...rest, checkIn: new Date(checkIn), checkOut: new Date(checkOut) } });
  }
  async updateBooking(vendorId: string, id: string, dto: UpdateRoomBookingDto): Promise<RoomBooking> {
    await this.ownBooking(vendorId, id);
    await this.assertRoom(vendorId, dto.roomId);
    const { checkIn, checkOut, ...rest } = dto;
    return this.prisma.roomBooking.update({
      where: { id },
      data: { ...rest, ...(checkIn !== undefined ? { checkIn: new Date(checkIn) } : {}), ...(checkOut !== undefined ? { checkOut: new Date(checkOut) } : {}) },
    });
  }
  async deleteBooking(vendorId: string, id: string): Promise<RoomBooking> {
    await this.ownBooking(vendorId, id);
    return this.prisma.roomBooking.delete({ where: { id } });
  }

  /** Accounts depth: occupancy, housekeeping backlog, in-house, month revenue. */
  async summary(vendorId: string): Promise<HotelSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [rooms, inHouse, monthBookings] = await Promise.all([
      this.prisma.room.findMany({ where: { vendorId }, select: { status: true, housekeeping: true } }),
      this.prisma.roomBooking.count({ where: { vendorId, status: 'checked_in' } }),
      this.prisma.roomBooking.findMany({ where: { vendorId, status: 'checked_out', checkOut: { gte: monthStart } }, select: { totalAmount: true } }),
    ]);
    const totalRooms = rooms.length;
    const occupied = rooms.filter((r) => r.status === 'occupied').length;
    const needsCleaning = rooms.filter((r) => r.housekeeping !== 'clean').length;
    const monthRevenue = monthBookings.reduce((s, b) => s + b.totalAmount, 0);
    return {
      totalRooms, occupied,
      occupancyPct: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
      needsCleaning, inHouse, monthRevenue,
    };
  }

  private async ownRoom(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.room.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Room not found');
  }
  private async ownBooking(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.roomBooking.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Booking not found');
  }
  private async assertRoom(vendorId: string, roomId?: string | null): Promise<void> {
    if (!roomId) return;
    const r = await this.prisma.room.findFirst({ where: { id: roomId, vendorId }, select: { id: true } });
    if (!r) throw new BadRequestException('Room not found');
  }
}
