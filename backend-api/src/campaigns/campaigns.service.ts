import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Campaign, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

export const CHANNEL_COSTS_PAISE: Record<string, number> = {
  whatsapp: 100,
  sms: 50,
  email: 10,
  facebook: 1000,
  instagram: 500,
  paid_ads: 20000,
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  estimateCost(channels: string[]): number {
    return channels.reduce((sum, channel) => sum + (CHANNEL_COSTS_PAISE[channel] ?? 0), 0);
  }

  create(vendorId: string, dto: CreateCampaignDto): Promise<Campaign> {
    return this.prisma.campaign.create({
      data: {
        vendorId,
        name: dto.name,
        description: dto.description,
        channels: dto.channels,
        content: dto.content as Prisma.InputJsonValue,
        walletCost: this.estimateCost(dto.channels),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: 'pending_approval',
      },
    });
  }

  findAllForVendor(vendorId: string): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
  }

  findAllAdmin(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string, vendorId: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.vendorId !== vendorId) throw new ForbiddenException('You do not own this campaign');
    return campaign;
  }

  async approve(id: string, vendorId: string): Promise<Campaign> {
    const campaign = await this.findOne(id, vendorId);

    await this.walletService.deduct(
      vendorId,
      campaign.walletCost,
      `Campaign approved: ${campaign.name}`,
      'campaign_approval',
    );

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'approved', approvedAt: new Date() },
    });

    await this.notificationsService.notifyAdmin(
      'campaign_approved',
      'Campaign ready for execution',
      `${campaign.name} was approved and is ready for your team to execute`,
      { priority: 'HIGH', actionRequired: true, actionType: 'execute_campaign', actionData: { campaignId: id } },
    );

    return updated;
  }

  async analytics(id: string, vendorId: string): Promise<Record<string, unknown>> {
    const campaign = await this.findOne(id, vendorId);
    return (campaign.analytics as Record<string, unknown>) ?? {};
  }
}
