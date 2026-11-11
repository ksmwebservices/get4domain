import { Injectable, Logger } from '@nestjs/common';

/**
 * Asks whatever sits in front of the public site to forget what it holds for a vendor (slice 5.5a: "publish purges the cache"). There is no CDN in front of the
 * site yet and no provider call is allowed in this run, so the bound implementation only records that a purge was requested. A real purge (Cloudflare) replaces it
 * behind this port in a later release; nothing else changes.
 */
export abstract class SiteCachePort {
  abstract purge(vendorId: string): Promise<void>;
}

@Injectable()
export class NoopSiteCache extends SiteCachePort {
  private readonly logger = new Logger(NoopSiteCache.name);
  requested = 0;
  async purge(vendorId: string): Promise<void> { this.requested++; this.logger.debug(`site cache purge requested for ${vendorId.slice(0, 8)}`); }
}
