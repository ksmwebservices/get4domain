import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CampaignPage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { GeneratePageDto } from './dto/generate-page.dto';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { SubmitLeadDto } from './dto/submit-lead.dto';

const LEAD_WA_ALERT_COST = 100; // paise (₹1)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CampaignPagesService {
  private readonly logger = new Logger(CampaignPagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly whatsappService: WhatsAppService,
    private readonly notificationsService: NotificationsService,
    private readonly aiService: AiService,
  ) {}

  generate(dto: GeneratePageDto) {
    return this.aiService.generatePage(dto);
  }

  async create(vendorId: string, dto: CreatePageDto): Promise<CampaignPage> {
    const slug = await this.uniqueSlug(dto.slug ?? dto.title);
    return this.prisma.campaignPage.create({
      data: {
        vendorId,
        slug,
        title: dto.title,
        headline: dto.headline,
        subheadline: dto.subheadline,
        benefits: dto.benefits,
        aboutText: dto.aboutText,
        heroImage: dto.heroImage,
        photos: dto.photos,
        style: dto.style ?? 'LIGHT',
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        email: dto.email,
        address: dto.address,
        mapsLink: dto.mapsLink,
        testimonials: dto.testimonials,
        ctaText: dto.ctaText ?? 'Enquire Now',
      },
    });
  }

  async findAllForVendor(vendorId: string) {
    const pages = await this.prisma.campaignPage.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    });
    return pages.map(({ _count, ...page }) => ({ ...page, leadCount: _count.leads }));
  }

  async findOne(id: string, vendorId: string): Promise<CampaignPage> {
    const page = await this.prisma.campaignPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Campaign page not found');
    if (page.vendorId !== vendorId) throw new ForbiddenException('You do not own this campaign page');
    return page;
  }

  async update(id: string, vendorId: string, dto: UpdatePageDto): Promise<CampaignPage> {
    await this.findOne(id, vendorId);
    return this.prisma.campaignPage.update({ where: { id }, data: dto });
  }

  async softDelete(id: string, vendorId: string): Promise<CampaignPage> {
    await this.findOne(id, vendorId);
    return this.prisma.campaignPage.update({ where: { id }, data: { active: false } });
  }

  async analytics(id: string, vendorId: string): Promise<{ views: number; leads: number; conversion: number }> {
    const page = await this.findOne(id, vendorId);
    const leads = await this.prisma.campaignLead.count({ where: { campaignPageId: id } });
    const conversion = page.views > 0 ? Number(((leads / page.views) * 100).toFixed(2)) : 0;
    return { views: page.views, leads, conversion };
  }

  async getPublicBySlug(slug: string): Promise<CampaignPage & { leadsThisWeek: number }> {
    const page = await this.prisma.campaignPage.findUnique({ where: { slug } });
    if (!page || !page.active) throw new NotFoundException('Page not found');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const leadsThisWeek = await this.prisma.campaignLead.count({
      where: { campaignPageId: page.id, createdAt: { gte: weekAgo } },
    });

    return { ...page, leadsThisWeek };
  }

  async incrementView(id: string): Promise<void> {
    await this.prisma.campaignPage.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => undefined);
  }

  async submitLead(slug: string, dto: SubmitLeadDto): Promise<{ success: true }> {
    const page = await this.prisma.campaignPage.findUnique({ where: { slug } });
    if (!page || !page.active) throw new NotFoundException('Page not found');

    await this.prisma.campaignLead.create({
      data: {
        campaignPageId: page.id,
        vendorId: page.vendorId,
        name: dto.name,
        phone: dto.phone,
        message: dto.message,
        source: 'campaign_page',
      },
    });

    await this.notificationsService.notifyVendor(
      page.vendorId,
      'new_lead',
      'New enquiry received',
      `${dto.name} (${dto.phone}) enquired on your page "${page.title}"`,
      { priority: 'HIGH', actionRequired: true, actionType: 'view_lead' },
    );

    await this.alertVendorByWhatsApp(page.vendorId, page.whatsapp, dto.name, dto.phone);

    return { success: true };
  }

  private async alertVendorByWhatsApp(vendorId: string, whatsapp: string, leadName: string, leadPhone: string): Promise<void> {
    try {
      const hasBalance = await this.walletService.hasSufficientBalance(vendorId, LEAD_WA_ALERT_COST);
      if (!hasBalance) return;
      await this.walletService.deduct(vendorId, LEAD_WA_ALERT_COST, `WhatsApp lead alert for ${leadName}`, 'lead_wa_alert');
      await this.whatsappService.sendTemplate(whatsapp, 'new_lead_alert', [leadName, leadPhone]);
    } catch (error) {
      this.logger.error('Lead WhatsApp alert failed', error instanceof Error ? error.stack : undefined);
    }
  }

  private async uniqueSlug(seed: string): Promise<string> {
    const base = slugify(seed) || 'page';
    let candidate = base;
    let suffix = 0;
    while (await this.prisma.campaignPage.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
