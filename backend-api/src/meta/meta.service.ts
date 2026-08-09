import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface PublishResult {
  postUrl: string;
  providerPostId: string;
  status: 'published' | 'mock';
  mock: boolean;
}

/**
 * Meta (Facebook / Instagram) publishing — MOCK implementation.
 * Vendors connect their FB/IG page once via OAuth (Meta app owned by
 * Get4Domain); backend publishes via Graph API. Swap the marked method for the
 * real Graph API call once Meta App Review is approved and credentials are set
 * via Admin → Integrations (meta category).
 */
@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  async publishPost(
    platform: 'facebook' | 'instagram',
    content: string,
    imageUrl?: string,
  ): Promise<PublishResult> {
    const token = await this.settings.getResolvedValue('meta', 'access_token');

    // TODO: swap for real Meta Graph API once App Review approved. Real shape:
    //   POST https://graph.facebook.com/v19.0/{page-id}/feed  (FB)
    //   POST https://graph.facebook.com/v19.0/{ig-user-id}/media + /media_publish (IG)
    //   headers: { Authorization: `Bearer ${token}` }
    this.logger.log(`[MOCK] Meta publish -> ${platform} (image=${imageUrl ? 'yes' : 'no'}): ${content.slice(0, 60)}`);
    const fakeId = `mock_${platform}_${Date.now()}`;
    return {
      postUrl: `https://${platform}.com/mock/${fakeId}`,
      providerPostId: fakeId,
      status: token ? 'published' : 'mock',
      mock: true,
    };
  }
}
