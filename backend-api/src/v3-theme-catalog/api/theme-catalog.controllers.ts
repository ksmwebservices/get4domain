import { Controller, Get, NotFoundException, Param, Query, Res, UseGuards } from '@nestjs/common';
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
export class PreviewQueryDto { @IsString() @MaxLength(60) pack!: string; @IsOptional() @IsString() @MaxLength(30) page?: string }

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

  @Public() @Throttle(RATE.siteRead)
  @Get(':id/preview')
  @ApiOperation({ summary: 'A generated preview page: the theme drawn by the real renderer with the sample business of a pack (pack=KEY, page=home|about|services|gallery|contact). No price, no vendor, never indexed.' })
  preview(@Param('id') id: string, @Query() q: PreviewQueryDto, @Res() res: Response): void {
    let html: string;
    try { html = this.catalogue.previewHtml(String(id).slice(0, 60), String(q.pack).toUpperCase().slice(0, 60), String(q.page ?? 'home')); } catch { throw new NotFoundException('Not found'); }
    res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:; base-uri 'none'; form-action 'none'" }).send(html);
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
