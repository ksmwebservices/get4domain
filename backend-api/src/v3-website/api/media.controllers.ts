import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { UploadTooLargeFilter } from '../../uploads/upload-too-large.filter';
import { BannerLibraryService, MediaService } from '../media/media.service';

/** multer's own limit is a transport ceiling only (the same figure as the older upload route); the real cap is the staff setting mediaMaxBytes, checked by the service. */
const TRANSPORT_LIMIT = 12 * 1024 * 1024;
interface UploadedImage { buffer: Buffer; mimetype: string; size: number }

export class SelectBannerDto { @IsString() @MaxLength(64) bannerId!: string; }
export class BannerActiveDto { @IsBoolean() active!: boolean; }

const vendorActor = (user: AuthenticatedUser, req: Request): Actor => ({ type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null });
const staffActor = (user: AuthenticatedUser, req: Request): Actor => ({ type: 'STAFF', id: user?.sub ?? null, ip: req?.ip ?? null });

/** The signed-in vendor's pictures and banner choices. The vendor is always the verified principal's vendor. */
@ApiTags('v3-website-media')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@Controller('v3/me/site')
export class MeMediaController {
  constructor(private readonly media: MediaService, private readonly banners: BannerLibraryService) {}

  @Get('media')
  @ApiOperation({ summary: 'My pictures' })
  list(@Tenant() t: TenantContext) { return this.media.list(t.vendorId); }

  @Post('media') @HttpCode(200)
  @ApiOperation({ summary: 'Upload a picture with its description (type, size and pixel caps are staff settings; the picture is re-encoded and its location data removed)' })
  @ApiConsumes('multipart/form-data')
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_LIMIT } }))
  upload(@Tenant() t: TenantContext, @UploadedFile() file: UploadedImage | undefined, @Body('alt') alt: unknown, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.media.upload(t.vendorId, vendorActor(user, req), file, alt);
  }

  @Delete('media/:id') @HttpCode(200)
  @ApiOperation({ summary: 'Remove one of my pictures (not while a page uses it)' })
  remove(@Tenant() t: TenantContext, @Param('id') id: string) { return this.media.remove(t.vendorId, id); }

  @Get('banners')
  @ApiOperation({ summary: 'The reference banners for my category' })
  choices(@Tenant() t: TenantContext) { return this.banners.forVendor(t.vendorId); }

  @Post('banner') @HttpCode(200)
  @ApiOperation({ summary: 'Use one of the reference banners as my top banner (saved to my draft)' })
  select(@Tenant() t: TenantContext, @Body() dto: SelectBannerDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.banners.select(t.vendorId, vendorActor(user, req), dto.bannerId);
  }
}

/** Staff: the Banner Library screen (with source, author and licence) and set-up on a vendor's behalf. Role matrix: reads of the library for all staff, everything else OPERATIONS and SUPER_ADMIN. */
@ApiTags('v3-website-media-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminMediaController {
  constructor(private readonly media: MediaService, private readonly banners: BannerLibraryService) {}

  @Get('banner-library')
  @ApiOperation({ summary: 'Every reference banner with its source, author, licence and date obtained (filter by category)' })
  library(@Query('categoryId') categoryId?: string) { return this.banners.adminList({ categoryId }); }

  @Put('banner-library/:id/active') @HttpCode(200)
  @ApiOperation({ summary: 'Switch a reference banner on or off' })
  active(@Param('id') id: string, @Body() dto: BannerActiveDto) { return this.banners.setActive(id, dto.active); }

  @Get('vendors/:id/site/banners')
  @ApiOperation({ summary: 'The banners available for one vendor (all of them, including pictures with people, when the category is regulated)' })
  vendorBanners(@Param('id') id: string) { return this.banners.forVendor(id, { includePeople: true }); }

  @Post('vendors/:id/site/banner') @HttpCode(200)
  @ApiOperation({ summary: 'Choose a reference banner for a vendor and publish it (staff setting up a site on the vendor\'s behalf)' })
  select(@Param('id') id: string, @Body() dto: SelectBannerDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.banners.select(id, staffActor(user, req), dto.bannerId, { staff: true }); }

  @Get('vendors/:id/site/media')
  @ApiOperation({ summary: 'A vendor\'s pictures' })
  vendorMedia(@Param('id') id: string) { return this.media.list(id); }

  @Post('vendors/:id/site/media') @HttpCode(200)
  @ApiOperation({ summary: 'Upload a picture on a vendor\'s behalf (same rules as the vendor; recorded in that vendor\'s activity with the staff member as the actor)' })
  @ApiConsumes('multipart/form-data')
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_LIMIT } }))
  upload(@Param('id') id: string, @UploadedFile() file: UploadedImage | undefined, @Body('alt') alt: unknown, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.media.upload(id, staffActor(user, req), file, alt);
  }
}
