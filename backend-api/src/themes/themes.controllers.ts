import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CommercialAdminGuard } from '../commercial/foundation.services';
import { LeadspaceStaffGuard } from '../leadspace/staff.guard';
import { ThemesAdminService } from './themes-admin.service';
import { THEME_UPLOAD_LIMIT } from './theme-limits';

class UpdateThemeDto {
  @IsOptional() @IsArray() categories?: string[];
  @IsOptional() @IsString() @MaxLength(20) role?: string;
  @IsOptional() @IsString() @MaxLength(20) replacesDesign?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(5_000_000) priceYearlyPaise?: number | null;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(80) name?: string;
}
class DuplicateThemeDto { @IsString() @MaxLength(40) key!: string }

/** Admin: Theme marketplace. Any staff (including MARKETING) can look and preview; only admins import, price and publish; money reports are admin only. */
@ApiTags('admin-themes')
@ApiBearerAuth()
@Controller('admin/themes')
export class ThemesAdminController {
  constructor(private readonly themes: ThemesAdminService) {}

  @UseGuards(LeadspaceStaffGuard) @Get() @ApiOperation({ summary: 'Every theme package and version' }) list() { return this.themes.list(); }
  @UseGuards(CommercialAdminGuard) @Get('report') @ApiOperation({ summary: 'Themes sold, active licences, revenue per theme and licences ending soon' }) report() { return this.themes.report(); }

  @UseGuards(CommercialAdminGuard) @Post('import')
  @ApiOperation({ summary: 'Upload a theme zip. It is checked and made safe; with ?dryRun=1 nothing is stored. A rejected upload says why in plain sentences.' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: THEME_UPLOAD_LIMIT, files: 1 } }))
  async import(@UploadedFile() file: { buffer?: Buffer } | undefined, @Query('dryRun') dryRun: string | undefined, @CurrentUser() u: AuthenticatedUser) {
    if (!file?.buffer) throw new BadRequestException('Choose a zip file to upload.');
    return this.themes.importZip(file.buffer, u.sub, { dryRun: dryRun === '1' || dryRun === 'true' });
  }

  @UseGuards(LeadspaceStaffGuard) @Get(':id') @ApiOperation({ summary: 'One theme: manifest, role, price, categories and its lint report' }) get(@Param('id') id: string) { return this.themes.get(id); }
  @UseGuards(LeadspaceStaffGuard) @Get(':id/preview-links') @ApiOperation({ summary: 'Private preview links (desktop and mobile) for every compatible category' }) previews(@Param('id') id: string) { return this.themes.previewLinks(id); }
  @UseGuards(CommercialAdminGuard) @Put(':id') @ApiOperation({ summary: 'Set categories, role, the built-in design it replaces, the yearly price and the status' }) update(@Param('id') id: string, @Body() dto: UpdateThemeDto) { return this.themes.update(id, dto); }
  @UseGuards(CommercialAdminGuard) @Post(':id/duplicate') @ApiOperation({ summary: 'Copy a theme under a new id (a draft)' }) duplicate(@Param('id') id: string, @Body() dto: DuplicateThemeDto, @CurrentUser() u: AuthenticatedUser) { return this.themes.duplicate(id, dto.key, u.sub); }
}

/** Public: what the website needs to draw a theme. Holds no vendor data. */
@ApiTags('themes')
@Controller('themes')
export class ThemesPublicController {
  constructor(private readonly themes: ThemesAdminService) {}

  @Public() @Get('package/:id') @ApiOperation({ summary: 'A live theme package as the website renders it (pages, scoped stylesheet, picture index)' }) pkg(@Param('id') id: string) { return this.themes.publicPackage(id); }

  @Public() @Get('sample/:id') @ApiOperation({ summary: 'A theme filled with one category\'s starter content, for previews' })
  sample(@Param('id') id: string, @Query('category') category: string, @Query('token') token?: string) { return this.themes.sample(id, category ?? '', token); }

  @Public() @Get('assets/:id/:name') @ApiOperation({ summary: 'One picture or font of a theme, cached for a year' })
  async asset(@Param('id') id: string, @Param('name') name: string, @Res() res: Response): Promise<void> {
    const a = await this.themes.asset(id, name);
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(a.data);
  }
}
