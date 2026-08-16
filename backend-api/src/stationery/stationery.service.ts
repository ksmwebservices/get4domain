import { Injectable, NotFoundException } from '@nestjs/common';
import { StationeryItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationeryDto, UpdateStationeryDto } from './dto/stationery.dto';

@Injectable()
export class StationeryService {
  constructor(private readonly prisma: PrismaService) {}
  list(vendorId: string): Promise<StationeryItem[]> {
    return this.prisma.stationeryItem.findMany({ where: { vendorId }, orderBy: { name: 'asc' } });
  }
  create(vendorId: string, dto: CreateStationeryDto): Promise<StationeryItem> {
    return this.prisma.stationeryItem.create({ data: { vendorId, ...dto } });
  }
  async update(vendorId: string, id: string, dto: UpdateStationeryDto): Promise<StationeryItem> {
    if (!(await this.prisma.stationeryItem.findFirst({ where: { id, vendorId } }))) throw new NotFoundException('Item not found');
    return this.prisma.stationeryItem.update({ where: { id }, data: dto });
  }
  async remove(vendorId: string, id: string): Promise<StationeryItem> {
    if (!(await this.prisma.stationeryItem.findFirst({ where: { id, vendorId } }))) throw new NotFoundException('Item not found');
    return this.prisma.stationeryItem.delete({ where: { id } });
  }
}
