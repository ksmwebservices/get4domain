import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { PackCatalogue, ThemeCatalogV3Service } from '../theme-catalog.service';

export class PackQueryDto { @IsOptional() @IsString() @MaxLength(60) pack?: string }

/** The themes of a pack, for anyone (Wave 3 Part H). No login, no price, no personal data. Cacheable for a few minutes. */
@ApiTags('v3-theme-catalog')
@Controller('v3/public/themes')
export class PublicThemesController {
  constructor(private readonly catalogue: ThemeCatalogV3Service) {}

  @Public() @Throttle(RATE.siteRead)
  @Get()
  @ApiOperation({ summary: 'The themes designed for a pack (pack=KEY), each marked DEFAULT (every plan has it) or LIBRARY (a paid plan has it)' })
  async list(@Query() q: PackQueryDto, @Res({ passthrough: true }) res: Response): Promise<PackCatalogue> {
    res.set('Cache-Control', 'public, max-age=300');
    return this.catalogue.forPack(String(q.pack ?? ''));
  }
}

/** The owner's own view of the theme choice (Wave 3 Part H): what the site uses, what may be applied now and why not, and the switch fee (a PENDING fee is no number). Owner only: it shows the fee. */
@ApiTags('v3-theme-catalog')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/site/themes')
export class MeThemesController {
  constructor(private readonly catalogue: ThemeCatalogV3Service) {}

  @Get()
  @ApiOperation({ summary: 'My theme choice: the theme my site uses, the themes designed for my kind of business with whether I may apply each now (PLAN_REQUIRED or NOT_FOR_YOUR_BUSINESS when not), and the theme switch fee before GST or PENDING' })
  view(@Tenant() t: TenantContext) { return this.catalogue.forVendor(t.vendorId); }
}
