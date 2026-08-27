import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Listing, Deal, PropertyVisit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateListingDto, UpdateListingDto, CreateDealDto, UpdateDealDto, CreateVisitDto, UpdateVisitDto,
} from './dto/realestate.dto';

export interface RealEstateSummary {
  openPipelineValue: number;            // value of deals not closed
  wonThisMonth: { count: number; value: number };
  activeListings: number;
  upcomingVisits: number;
  byStage: { stage: string; count: number; value: number }[];
}
const OPEN = ['new', 'site_visit', 'negotiation'];

@Injectable()
export class RealEstateService {
  constructor(private readonly prisma: PrismaService) {}

  // Listings
  listListings(vendorId: string): Promise<Listing[]> {
    return this.prisma.listing.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }
  createListing(vendorId: string, dto: CreateListingDto): Promise<Listing> {
    return this.prisma.listing.create({ data: { vendorId, ...dto } });
  }
  async updateListing(vendorId: string, id: string, dto: UpdateListingDto): Promise<Listing> {
    await this.own('listing', vendorId, id);
    return this.prisma.listing.update({ where: { id }, data: dto });
  }
  async deleteListing(vendorId: string, id: string): Promise<Listing> {
    await this.own('listing', vendorId, id);
    return this.prisma.listing.delete({ where: { id } });
  }

  // Deals
  listDeals(vendorId: string): Promise<Deal[]> {
    return this.prisma.deal.findMany({ where: { vendorId }, orderBy: { updatedAt: 'desc' }, include: { listing: { select: { id: true, title: true } } } });
  }
  async createDeal(vendorId: string, dto: CreateDealDto): Promise<Deal> {
    await this.assertListing(vendorId, dto.listingId);
    return this.prisma.deal.create({ data: { vendorId, ...dto } });
  }
  async updateDeal(vendorId: string, id: string, dto: UpdateDealDto): Promise<Deal> {
    await this.own('deal', vendorId, id);
    await this.assertListing(vendorId, dto.listingId);
    return this.prisma.deal.update({ where: { id }, data: dto });
  }
  async deleteDeal(vendorId: string, id: string): Promise<Deal> {
    await this.own('deal', vendorId, id);
    return this.prisma.deal.delete({ where: { id } });
  }

  // Visits
  listVisits(vendorId: string): Promise<PropertyVisit[]> {
    return this.prisma.propertyVisit.findMany({ where: { vendorId }, orderBy: { scheduledAt: 'desc' }, include: { listing: { select: { id: true, title: true } } } });
  }
  async createVisit(vendorId: string, dto: CreateVisitDto): Promise<PropertyVisit> {
    await this.assertListing(vendorId, dto.listingId);
    const { scheduledAt, ...rest } = dto;
    return this.prisma.propertyVisit.create({ data: { vendorId, ...rest, scheduledAt: new Date(scheduledAt) } });
  }
  async updateVisit(vendorId: string, id: string, dto: UpdateVisitDto): Promise<PropertyVisit> {
    await this.own('propertyVisit', vendorId, id);
    await this.assertListing(vendorId, dto.listingId);
    const { scheduledAt, ...rest } = dto;
    return this.prisma.propertyVisit.update({ where: { id }, data: { ...rest, ...(scheduledAt !== undefined ? { scheduledAt: new Date(scheduledAt) } : {}) } });
  }
  async deleteVisit(vendorId: string, id: string): Promise<PropertyVisit> {
    await this.own('propertyVisit', vendorId, id);
    return this.prisma.propertyVisit.delete({ where: { id } });
  }

  /** Accounts depth: pipeline value, won this month, deals by stage. */
  async summary(vendorId: string): Promise<RealEstateSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [deals, activeListings, upcomingVisits] = await Promise.all([
      this.prisma.deal.findMany({ where: { vendorId }, select: { stage: true, value: true, updatedAt: true } }),
      this.prisma.listing.count({ where: { vendorId, status: 'available' } }),
      this.prisma.propertyVisit.count({ where: { vendorId, status: 'scheduled', scheduledAt: { gte: now } } }),
    ]);
    const openPipelineValue = deals.filter((d) => OPEN.includes(d.stage)).reduce((s, d) => s + d.value, 0);
    const won = deals.filter((d) => d.stage === 'closed_won' && d.updatedAt >= monthStart);
    const map = new Map<string, { count: number; value: number }>();
    for (const d of deals) { const cur = map.get(d.stage) ?? { count: 0, value: 0 }; cur.count += 1; cur.value += d.value; map.set(d.stage, cur); }
    const byStage = [...map.entries()].map(([stage, v]) => ({ stage, ...v }));
    return { openPipelineValue, wonThisMonth: { count: won.length, value: won.reduce((s, d) => s + d.value, 0) }, activeListings, upcomingVisits, byStage };
  }

  private async own(model: 'listing' | 'deal' | 'propertyVisit', vendorId: string, id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (this.prisma[model] as any).findFirst({ where: { id, vendorId }, select: { id: true } });
    if (!row) throw new NotFoundException('Not found');
  }
  private async assertListing(vendorId: string, listingId?: string | null): Promise<void> {
    if (!listingId) return;
    const l = await this.prisma.listing.findFirst({ where: { id: listingId, vendorId }, select: { id: true } });
    if (!l) throw new BadRequestException('Listing not found');
  }
}
