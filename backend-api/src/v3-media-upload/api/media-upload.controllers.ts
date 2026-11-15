import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { UploadTooLargeFilter } from '../../uploads/upload-too-large.filter';
import { uploadError } from '../media-upload.errors';
import { MediaUploadService, UploadedFile as UploadedFileShape } from '../media-upload.service';

/** multer's own limit is a transport ceiling only; the real caps are the staff settings mediaUploadMaxBytes and mediaUploadMaxPixels, checked by the service. */
const TRANSPORT_LIMIT = 16 * 1024 * 1024;
class AttachDto { @IsString() @MaxLength(80) group!: string }
class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
const vendorActor = (u: AuthenticatedUser, req: Request): Actor => ({ type: 'VENDOR', id: u?.sub ?? null, ip: req?.ip ?? null });
const staffActor = (u: AuthenticatedUser, req: Request): Actor => ({ type: 'STAFF', id: u?.sub ?? null, ip: req?.ip ?? null });
const staffId = (u: AuthenticatedUser): string => { if (!u?.sub) throw uploadError('UPLOAD_NOT_FOUND', 'That file was not found.'); return u.sub; };

/** A vendor's uploads for their own site (pictures and pdf documents). The vendor is always the verified principal's vendor; a team member needs the website area. */
@ApiTags('v3-media-upload-me')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@Controller('v3/me/media')
export class MeMediaUploadController {
  constructor(private readonly media: MediaUploadService) {}

  @Get() @ApiOperation({ summary: 'My uploaded pictures and documents, newest first' })
  list(@Tenant() t: TenantContext, @Query() q: PageDto) { return this.media.list({ kind: 'VENDOR', vendorId: t.vendorId }, q.page, q.pageSize); }

  @Throttle(RATE.recordWrite) @Post() @HttpCode(200) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a picture (jpeg, png, webp, or an svg with nothing active in it) or a pdf. The file is judged by its bytes; the caps and the allowed types are staff settings.' })
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_LIMIT, files: 1 } }))
  upload(@Tenant() t: TenantContext, @UploadedFile() file: UploadedFileShape | undefined, @Body('alt') alt: unknown, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.media.upload({ kind: 'VENDOR', vendorId: t.vendorId }, vendorActor(u, req), file, alt);
  }

  @Throttle(RATE.recordWrite) @Delete(':id') @HttpCode(200) @ApiOperation({ summary: 'Remove one of my uploads (it is hidden and the stored file is deleted)' })
  remove(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.media.remove({ kind: 'VENDOR', vendorId: t.vendorId }, id, vendorActor(u, req)); }
}

/**
 * Staff uploads (C11). WHO may call each route is DATA in admin-role-matrix.ts: every staff role that creates listings on behalf (SALES included) may upload for a listing or keep a draft upload of their own; a
 * route with no entry is SUPER_ADMIN only. A draft upload (no listing yet) belongs to the staff member who made it and nobody else sees it.
 */
@ApiTags('v3-media-upload-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminMediaUploadController {
  constructor(private readonly media: MediaUploadService) {}

  @Get('seeded-sites/:id/media') @ApiOperation({ summary: 'The uploads of the business behind a listing made on behalf' })
  listing(@Param('id') id: string, @Query() q: PageDto) { return this.media.listForListing(id, q.page, q.pageSize); }

  @Throttle(RATE.recordWrite) @Post('seeded-sites/:id/media') @HttpCode(200) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a picture or a pdf for a listing made on behalf (audited; the owner finds it in their library after claiming)' })
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_LIMIT, files: 1 } }))
  uploadListing(@Param('id') id: string, @UploadedFile() file: UploadedFileShape | undefined, @Body('alt') alt: unknown, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.media.uploadForListing(id, staffActor(u, req), file, alt); }

  @Throttle(RATE.recordWrite) @Delete('seeded-sites/:id/media/:mediaId') @HttpCode(200) @ApiOperation({ summary: 'Remove an upload of a listing made on behalf (audited)' })
  removeListing(@Param('id') id: string, @Param('mediaId') mediaId: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.media.removeForListing(id, mediaId, staffActor(u, req)); }

  @Get('media/drafts') @ApiOperation({ summary: 'My draft uploads: files I uploaded before a listing or a business account existed' })
  drafts(@CurrentUser() u: AuthenticatedUser, @Query() q: PageDto) { return this.media.list({ kind: 'DRAFT', staffId: staffId(u) }, q.page, q.pageSize); }

  @Throttle(RATE.recordWrite) @Post('media/drafts') @HttpCode(200) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a picture or a pdf before the listing exists (a draft upload; only the person who made it sees it; audited). An optional `group` token lets the create form attach it to the listing when it is made.' })
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_LIMIT, files: 1 } }))
  uploadDraft(@UploadedFile() file: UploadedFileShape | undefined, @Body('alt') alt: unknown, @Body('group') group: unknown, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.media.upload({ kind: 'DRAFT', staffId: staffId(u) }, staffActor(u, req), file, alt, group); }

  @Throttle(RATE.recordWrite) @Post('seeded-sites/:id/media/attach') @HttpCode(200) @ApiOperation({ summary: 'Attach the draft uploads I made under an upload group to this listing (idempotent: a second call moves nothing; only my own drafts move; audited)' })
  attach(@Param('id') id: string, @Body() dto: AttachDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.media.attachGroup(dto.group, staffActor(u, req), { seededSiteId: id }); }

  @Throttle(RATE.recordWrite) @Delete('media/drafts/:mediaId') @HttpCode(200) @ApiOperation({ summary: 'Remove one of my draft uploads (audited)' })
  removeDraft(@Param('mediaId') mediaId: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.media.remove({ kind: 'DRAFT', staffId: staffId(u) }, mediaId, staffActor(u, req)); }
}
