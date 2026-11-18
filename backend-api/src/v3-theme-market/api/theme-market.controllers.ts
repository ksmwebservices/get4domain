import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RATE } from '../../common/throttling';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { UploadTooLargeFilter } from '../../uploads/upload-too-large.filter';
import { MAX_PACKAGE_BYTES, ThemeMarketService, UploadedZip } from '../theme-market.service';
import { ThemeFilter, ThemeStatus, ThemeVisibility } from '../theme-market.store';

const ID = /^[A-Za-z0-9_-]{8,40}$/;
class ThemeListDto {
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(20) visibility?: string;
  @IsOptional() @IsString() @MaxLength(60) pack?: string;
  @IsOptional() @IsString() @MaxLength(60) addon?: string;
  @IsOptional() @IsString() @MaxLength(60) capability?: string;
  @IsOptional() @IsString() @MaxLength(60) tag?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(20) tier?: string;
  @IsOptional() @IsString() @MaxLength(40) key?: string;
  @IsOptional() @IsString() @Matches(ID) vendorId?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(5) starter?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
class UploadBodyDto { @IsOptional() @IsString() @Matches(ID) vendorId?: string }
class NoteDto { @IsString() @MaxLength(300) note!: string }

const toFilter = (q: ThemeListDto): ThemeFilter => ({
  status: q.status as ThemeStatus | undefined, visibility: q.visibility as ThemeVisibility | undefined, pack: q.pack, addon: q.addon, capability: q.capability, tag: q.tag, category: q.category, tier: q.tier, key: q.key,
  privateVendorId: q.vendorId, q: q.q, ...(q.starter === 'true' ? { starter: true } : q.starter === 'false' ? { starter: false } : {}),
});
const TRANSPORT = { fileSize: MAX_PACKAGE_BYTES + 1024, files: 1, fields: 4 } as const;

/**
 * The theme marketplace, admin side (TM1 M2). WHO may call each route is DATA in admin-role-matrix.ts: reading is OPERATIONS, ADMIN and SUPER_ADMIN; every change is ADMIN and SUPER_ADMIN. The package is
 * untrusted: it is inspected in memory and stored only when every rule passes; a rejection lists every problem with its file and rule.
 */
@ApiTags('v3-theme-market-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/theme-market')
export class AdminThemeMarketController {
  constructor(private readonly themes: ThemeMarketService) {}

  @Throttle(RATE.themeUpload) @Post('validate') @HttpCode(200) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Check a theme package (zip in the "file" field) against every rule and report all problems; nothing is stored' })
  @UseFilters(UploadTooLargeFilter) @UseInterceptors(FileInterceptor('file', { limits: TRANSPORT }))
  validate(@UploadedFile() file: UploadedZip | undefined, @Body() body: UploadBodyDto) { return this.themes.validate(file, body?.vendorId ?? null); }

  @Throttle(RATE.themeUpload) @Post('themes') @HttpCode(200) @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a theme package (zip in the "file" field) as a DRAFT. Without vendorId it is for the marketplace; with vendorId it is a PRIVATE theme for that one business. Every problem is listed with its file and rule (422 THEME_PACKAGE_INVALID). The same bytes sent again are the same upload.' })
  @UseFilters(UploadTooLargeFilter) @UseInterceptors(FileInterceptor('file', { limits: TRANSPORT }))
  upload(@UploadedFile() file: UploadedZip | undefined, @Body() body: UploadBodyDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.themes.upload(actorOf(u, req), file, { vendorId: body?.vendorId ?? null }); }

  @Get('themes') @ApiOperation({ summary: 'Every stored theme version (no file bytes), filtered by status, visibility, pack, add-on, capability, combination tag, category, tier, key or business; newest versions first' })
  list(@Query() q: ThemeListDto) { return this.themes.list(toFilter(q), q.page ?? 1, q.pageSize ?? 25); }

  @Get('themes/:id') @ApiOperation({ summary: 'One theme version with its marketplace metadata, status, consent record and review note' })
  get(@Param('id') id: string) { return this.themes.get(id); }

  @Post('themes/:id/submit') @HttpCode(200) @ApiOperation({ summary: 'Send a DRAFT for review (DRAFT to REVIEW)' })
  submit(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.themes.submit(id, actorOf(u, req)); }

  @Post('themes/:id/return') @HttpCode(200) @ApiOperation({ summary: 'Send a theme in REVIEW back to DRAFT with a note (3 to 300 characters)' })
  returnToDraft(@Param('id') id: string, @Body() dto: NoteDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.themes.returnToDraft(id, dto.note, actorOf(u, req)); }

  @Post('themes/:id/publish') @HttpCode(200) @ApiOperation({ summary: 'Publish a theme in REVIEW: every rule is checked again on the stored package (409 THEME_PUBLISH_BLOCKED lists what fails), then it goes live for vendors with no restart' })
  publish(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.themes.publish(id, actorOf(u, req)); }

  @Post('themes/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a theme: it is no longer offered; a business already using it keeps it until it switches' })
  archive(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.themes.archive(id, actorOf(u, req)); }
}
