import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Vehicle, Driver, Trip, VisaApplication } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';
import { CreateTripDto, UpdateTripDto } from './dto/trip.dto';
import { CreateVisaDto, UpdateVisaDto } from './dto/visa.dto';

const toDate = (v?: string): Date | undefined => (v ? new Date(v) : undefined);

@Injectable()
export class TravelService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vehicles (Fleet) ──────────────────────────────────────────────────────
  listVehicles(vendorId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  createVehicle(vendorId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data: { vendorId, ...dto } });
  }

  async updateVehicle(vendorId: string, id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    await this.ownVehicle(vendorId, id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async deleteVehicle(vendorId: string, id: string): Promise<Vehicle> {
    await this.ownVehicle(vendorId, id);
    return this.prisma.vehicle.delete({ where: { id } });
  }

  // ── Drivers ───────────────────────────────────────────────────────────────
  listDrivers(vendorId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  createDriver(vendorId: string, dto: CreateDriverDto): Promise<Driver> {
    return this.prisma.driver.create({ data: { vendorId, ...dto } });
  }

  async updateDriver(vendorId: string, id: string, dto: UpdateDriverDto): Promise<Driver> {
    await this.ownDriver(vendorId, id);
    return this.prisma.driver.update({ where: { id }, data: dto });
  }

  async deleteDriver(vendorId: string, id: string): Promise<Driver> {
    await this.ownDriver(vendorId, id);
    return this.prisma.driver.delete({ where: { id } });
  }

  // ── Trips (itinerary builder + assignment) ────────────────────────────────
  listTrips(vendorId: string): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { vehicle: true, driver: true, visas: true },
    });
  }

  async createTrip(vendorId: string, dto: CreateTripDto): Promise<Trip> {
    await this.assertAssignmentsOwned(vendorId, dto.vehicleId, dto.driverId);
    const { startDate, endDate, itinerary, ...rest } = dto;
    return this.prisma.trip.create({
      data: {
        vendorId,
        ...rest,
        startDate: toDate(startDate),
        endDate: toDate(endDate),
        itinerary: itinerary ? (itinerary as object[]) : undefined,
      },
    });
  }

  async updateTrip(vendorId: string, id: string, dto: UpdateTripDto): Promise<Trip> {
    await this.ownTrip(vendorId, id);
    await this.assertAssignmentsOwned(vendorId, dto.vehicleId, dto.driverId);
    const { startDate, endDate, itinerary, ...rest } = dto;
    return this.prisma.trip.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: toDate(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: toDate(endDate) } : {}),
        ...(itinerary !== undefined ? { itinerary: itinerary as object[] } : {}),
      },
    });
  }

  async deleteTrip(vendorId: string, id: string): Promise<Trip> {
    await this.ownTrip(vendorId, id);
    return this.prisma.trip.delete({ where: { id } });
  }

  // ── Visa applications ─────────────────────────────────────────────────────
  listVisas(vendorId: string): Promise<VisaApplication[]> {
    return this.prisma.visaApplication.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  createVisa(vendorId: string, dto: CreateVisaDto): Promise<VisaApplication> {
    const { appliedDate, decisionDate, ...rest } = dto;
    return this.prisma.visaApplication.create({
      data: { vendorId, ...rest, appliedDate: toDate(appliedDate), decisionDate: toDate(decisionDate) },
    });
  }

  async updateVisa(vendorId: string, id: string, dto: UpdateVisaDto): Promise<VisaApplication> {
    await this.ownVisa(vendorId, id);
    const { appliedDate, decisionDate, ...rest } = dto;
    return this.prisma.visaApplication.update({
      where: { id },
      data: {
        ...rest,
        ...(appliedDate !== undefined ? { appliedDate: toDate(appliedDate) } : {}),
        ...(decisionDate !== undefined ? { decisionDate: toDate(decisionDate) } : {}),
      },
    });
  }

  async deleteVisa(vendorId: string, id: string): Promise<VisaApplication> {
    await this.ownVisa(vendorId, id);
    return this.prisma.visaApplication.delete({ where: { id } });
  }

  // ── Ownership guards (tenant isolation) ───────────────────────────────────
  private async ownVehicle(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.vehicle.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Vehicle not found');
  }
  private async ownDriver(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.driver.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Driver not found');
  }
  private async ownTrip(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.trip.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Trip not found');
  }
  private async ownVisa(vendorId: string, id: string): Promise<void> {
    const row = await this.prisma.visaApplication.findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Visa application not found');
  }

  /** A trip may only be assigned a vehicle/driver that belongs to the same vendor. */
  private async assertAssignmentsOwned(vendorId: string, vehicleId?: string | null, driverId?: string | null): Promise<void> {
    if (vehicleId) {
      const v = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, vendorId }, select: { id: true } });
      if (!v) throw new BadRequestException('Assigned vehicle not found');
    }
    if (driverId) {
      const d = await this.prisma.driver.findFirst({ where: { id: driverId, vendorId }, select: { id: true } });
      if (!d) throw new BadRequestException('Assigned driver not found');
    }
  }
}
