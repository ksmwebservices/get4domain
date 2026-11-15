import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { SeoBacklinkService } from '../backlinks/seo-backlink.service';
import { seoError } from '../seo-directory.errors';

/** The signed-in owner's own badge and text link. The vendor is the verified principal's vendor (@UseTenant): never in the URL, query or body. Owner only. */
@ApiTags('v3-directory-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/directory')
export class SeoMeController {
  constructor(private readonly backlinks: SeoBacklinkService) {}

  @Get('badge')
  @ApiOperation({ summary: 'My "Listed on Get4Domain" badge snippet and the plain text link "Find {my business} on Get4Domain", for my own site, Google profile or social bio' })
  async badge(@Tenant() t: TenantContext) {
    const b = await this.backlinks.listedOfVendor(t.vendorId);
    if (!b) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'Your business has no listing in the directory yet.'));
    return this.backlinks.embedOf(b);
  }
}
