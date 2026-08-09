import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Campaign } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService, PublishResult } from '../meta/meta.service';
import { GoogleAdsService } from '../google-ads/google-ads.service';
import { AdRequestDto, PublishDto } from './dto/growth-hub.dto';

@Injectable()
export class GrowthHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
    private readonly googleAds: GoogleAdsService,
  ) {}

  /** Direct social publish (mock Meta layer). */
  publish(dto: PublishDto): Promise<PublishResult> {
    return this.meta.publishPost(dto.platform, dto.content, dto.imageUrl);
  }

  /** Vendor submits an ad request → stored as a Campaign pending admin review. */
  async requestAd(vendorId: string, dto: AdRequestDto): Promise<Campaign> {
    return this.prisma.campaign.create({
      data: {
        vendorId,
        name: dto.name ?? `${dto.objective} ad`,
        description: dto.audience,
        status: 'pending_review',
        channels: [dto.channel ?? 'meta_ads'] as Prisma.InputJsonValue,
        content: {
          objective: dto.objective,
          budget: dto.budget,
          durationDays: dto.durationDays,
          audience: dto.audience,
        } as Prisma.InputJsonValue,
        walletCost: 0,
      },
    });
  }

  async listAds(vendorId: string): Promise<Campaign[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
    // An ad campaign is tagged with a meta_ads/google_ads channel.
    return campaigns.filter((c) => {
      const channels = Array.isArray(c.channels) ? (c.channels as unknown[]) : [];
      return channels.includes('meta_ads') || channels.includes('google_ads');
    });
  }

  /** Admin launches an approved ad campaign (mock Google/Meta Ads layer). */
  async launchAd(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Ad campaign not found');
    }
    const content = campaign.content as Record<string, unknown>;
    const result = await this.googleAds.launchCampaign({
      objective: String(content.objective ?? 'lead_generation'),
      budget: Number(content.budget ?? 0),
      durationDays: Number(content.durationDays ?? 1),
      audience: String(content.audience ?? ''),
    });
    return this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'active',
        approvedAt: new Date(),
        analytics: { externalCampaignId: result.externalCampaignId, mock: result.mock } as Prisma.InputJsonValue,
      },
    });
  }
}
