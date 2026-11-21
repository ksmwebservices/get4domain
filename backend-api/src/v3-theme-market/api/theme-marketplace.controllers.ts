import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { PREVIEW_HEADERS } from '../core/theme-preview-core';
import { ThemeMarketplaceService } from '../theme-marketplace.service';
import { PreviewQueryDto } from './theme-market.controllers';

export class MarketplaceQueryDto {
  @IsOptional() @IsString() @MaxLength(60) pack?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(60) addon?: string;
  @IsOptional() @IsString() @MaxLength(60) capability?: string;
  @IsOptional() @IsString() @MaxLength(60) tag?: string;
  @IsOptional() @IsString() @MaxLength(20) tier?: string;
  @IsOptional() @IsString() @MaxLength(5) starter?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

const send = (res: Response, html: string): void => { res.removeHeader('Set-Cookie'); res.status(200).set(PREVIEW_HEADERS).send(html); };

/** The marketplace for anyone (TM1 M5): the themes a visitor may be shown. No login, no vendor, no price, no count, no ranking. Sorted by name. */
@ApiTags('v3-theme-market-public')
@Controller('v3/public/theme-market')
export class PublicThemeMarketController {
  constructor(private readonly market: ThemeMarketplaceService) {}

  @Public() @Throttle(RATE.siteRead) @Get('themes')
  @ApiOperation({ summary: 'Themes in the marketplace and the library, filtered by pack, catalogue category, add-on, capability, combination tag, tier or starter; sorted by name; each with the packs it is designed for and a preview path' })
  list(@Query() q: MarketplaceQueryDto, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=60'); return this.market.publicList(q); }

  @Public() @Throttle(RATE.siteRead) @Get('themes/:key')
  @ApiOperation({ summary: 'One theme: what it is designed for, its pages and a preview path for each pack' })
  detail(@Param('key') key: string, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=60'); return this.market.publicDetail(key); }

  @Public() @Throttle(RATE.themePreview) @Get('themes/:key/preview')
  @ApiOperation({ summary: 'A preview page: the theme drawn by the real renderer with the sample business of a pack. Strict content security policy, no cookie, never indexed. No price, no offer, no review.' })
  async preview(@Param('key') key: string, @Query() q: PreviewQueryDto, @Res() res: Response): Promise<void> { send(res, await this.market.publicPreview(key, q.pack, q.page)); }
}

/**
 * A business's own view of the marketplace (TM1 M5). OWNER only (it shows the theme switch fee and the plan state). Choosing a theme is NOT here: it stays POST /v3/me/site/theme/switch (idempotent,
 * wallet-paid fee from the price book, a Free plan refused with FEATURE_LOCKED); this only says what the business may apply now and why not (PLAN_REQUIRED, NOT_FOR_YOUR_BUSINESS).
 */
@ApiTags('v3-theme-market-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/theme-market')
export class MeThemeMarketController {
  constructor(private readonly market: ThemeMarketplaceService) {}

  @Get('themes')
  @ApiOperation({ summary: 'The themes designed for my kind of business (library and marketplace, my own private themes included), filtered like the public list, each with allowed and the reason when not, whether it is selected, and the switch fee before GST or PENDING' })
  list(@Tenant() t: TenantContext, @Query() q: MarketplaceQueryDto) { return this.market.meList(t.vendorId, q); }

  @Get('themes/:key')
  @ApiOperation({ summary: 'One theme as it applies to my business: allowed, reason, selected, fee, pages and a preview path for each pack. 404 THEME_NOT_AVAILABLE for a theme I may not see (another business\'s private theme, an unpublished or archived one I do not use)' })
  detail(@Tenant() t: TenantContext, @Param('key') key: string) { return this.market.meDetail(t.vendorId, key); }

  @Throttle(RATE.themePreview) @Get('themes/:key/preview')
  @ApiOperation({ summary: 'A preview page of a theme I may see, drawn with the sample business of a pack. Strict content security policy, no cookie, never cached, never indexed.' })
  async preview(@Tenant() t: TenantContext, @Param('key') key: string, @Query() q: PreviewQueryDto, @Res() res: Response): Promise<void> { send(res, await this.market.mePreview(t.vendorId, key, q.pack, q.page)); }
}
