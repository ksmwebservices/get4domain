import { Injectable, Optional } from '@nestjs/common';
import { CanonicalSwitchService } from '../site-domains/canonical-switch.service';

/**
 * The door to the custom-domain promotion add-on (slice 5.6b). Approving a CUSTOM_DOMAIN_PROMOTION request creates the entitlement override through the EXISTING audited path
 * (CanonicalSwitchService.grantAddon: the override service, then the controlled canonical switch). The end date is the one staff set on the request, never a number chosen by code.
 */
export abstract class PromotionGrantPort {
  abstract grantCustomDomain(vendorId: string, endsAt: Date, reason: string): Promise<string>;
}

@Injectable()
export class CanonicalPromotionGrant extends PromotionGrantPort {
  constructor(@Optional() private readonly canonical?: CanonicalSwitchService) { super(); }
  async grantCustomDomain(vendorId: string, endsAt: Date, reason: string): Promise<string> {
    if (!this.canonical) throw new Error('the custom-domain add-on service is not available');
    const r = await this.canonical.grantAddon(vendorId, { type: 'SYSTEM', id: null, ip: null }, reason, endsAt.toISOString());
    return r.overrideId;
  }
}
