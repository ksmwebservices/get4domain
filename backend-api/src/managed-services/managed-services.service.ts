import { Injectable, NotFoundException } from '@nestjs/common';
import { Lead, ManagedServiceCatalogItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateManagedServicesEnquiryDto } from './dto/create-enquiry.dto';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog-item.dto';

// Seed catalog KSM can edit from the admin settings area — placeholder rates
// only, not real pricing (dispatch 01-Oct-2026: "seed with reasonable
// placeholder values KSM can change, don't invent real pricing yourself").
// Rates are round, obviously-placeholder figures in paise.
const SEED_CATALOG: Omit<CreateCatalogItemDto, 'sortOrder'>[] = [
  { label: 'Custom Web Application', description: 'Bespoke web application beyond a DomainApp site.', defaultRate: 10000000, unit: 'one-time' },
  { label: 'Mobile Application (iOS/Android)', description: 'Native or cross-platform mobile app.', defaultRate: 15000000, unit: 'one-time' },
  { label: 'CRM / ERP / BOS System', description: 'Full bespoke business software build.', defaultRate: 20000000, unit: 'one-time' },
  { label: 'Paid Ads Management — Meta', description: 'Facebook & Instagram ads, managed monthly.', defaultRate: 1500000, unit: 'per month' },
  { label: 'Paid Ads Management — Google', description: 'Google Search/Display/YouTube ads, managed monthly.', defaultRate: 1500000, unit: 'per month' },
  { label: 'Content Creation (monthly retainer)', description: 'Posts, reels and creative, produced monthly.', defaultRate: 2000000, unit: 'per month' },
  { label: 'Influencer Collaboration', description: 'Sourcing and managing influencer partnerships.', defaultRate: 5000000, unit: 'per project' },
  { label: 'Commercial Ad Production', description: 'Produced commercial/brand film.', defaultRate: 10000000, unit: 'per project' },
  { label: 'Social Media Management', description: 'Ongoing social account management.', defaultRate: 1200000, unit: 'per month' },
  { label: 'Custom / Other', description: 'Anything not covered above — priced per scope.', defaultRate: 0, unit: 'per project' },
];

@Injectable()
export class ManagedServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Public "Get a Custom Quote" enquiry. Recorded on the existing leads pipeline
   * (g4d_leads), tagged source: 'managed-services' so it's distinguishable from
   * DomainApp trial/signup leads in the admin CRM — same pattern as
   * support.service.ts's requestCallback(), no new table.
   */
  async createEnquiry(dto: CreateManagedServicesEnquiryDto): Promise<{ queued: boolean; leadId: string }> {
    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        business: dto.business,
        industry: 'managed-services',
        interest: dto.interests.join(', ') || 'Managed Services',
        source: 'managed-services',
        status: 'pending',
        message: dto.message ?? null,
      },
    });

    await this.emailService.sendAdminNotification(
      'New Managed Services enquiry',
      `${dto.name} (${dto.business}) — ${dto.phone}${dto.email ? `, ${dto.email}` : ''} is interested in: ${dto.interests.join(', ')}.${dto.message ? ` Message: ${dto.message}` : ''}`,
    );
    await this.notificationsService.notifyAdmin(
      'managed_services_enquiry',
      'Managed Services enquiry',
      `${dto.name} (${dto.business}) wants a custom quote.`,
      { priority: 'HIGH', actionRequired: true, actionType: 'view_lead', actionData: { leadId: lead.id } },
    );

    return { queued: true, leadId: lead.id };
  }

  async listLeads(): Promise<Lead[]> {
    return this.prisma.lead.findMany({ where: { source: 'managed-services' }, orderBy: { createdAt: 'desc' } });
  }

  /** Seeds the placeholder catalog once (idempotent — no-op if any rows exist). */
  private async ensureSeeded(): Promise<void> {
    const count = await this.prisma.managedServiceCatalogItem.count();
    if (count > 0) return;
    await this.prisma.managedServiceCatalogItem.createMany({
      data: SEED_CATALOG.map((item, i) => ({ ...item, sortOrder: i })),
    });
  }

  async getCatalog(includeInactive = false): Promise<ManagedServiceCatalogItem[]> {
    await this.ensureSeeded();
    return this.prisma.managedServiceCatalogItem.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  createCatalogItem(dto: CreateCatalogItemDto): Promise<ManagedServiceCatalogItem> {
    return this.prisma.managedServiceCatalogItem.create({ data: dto });
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemDto): Promise<ManagedServiceCatalogItem> {
    const item = await this.prisma.managedServiceCatalogItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Catalog item not found');
    return this.prisma.managedServiceCatalogItem.update({ where: { id }, data: dto });
  }
}
