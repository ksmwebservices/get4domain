import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RATE } from '../../common/throttling';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { StaffRole } from '../../seeded-sites/seeded-sites.service';
import { ListingImportService } from '../listing-import.service';
import type { Request } from 'express';
import { Req } from '@nestjs/common';

class ImportDto { @IsString() @MaxLength(1_100_000) csv!: string }
class TemplateQueryDto { @IsOptional() @IsString() @MaxLength(80) category?: string }
const role = (u: AuthenticatedUser): StaffRole => (u?.adminRole as StaffRole) ?? 'MARKETING';

/**
 * The listing import for staff (Wave 2 Part D). WHO may call it is DATA in admin-role-matrix.ts: every staff role that creates listings on behalf (SALES included). The dry run is the default and creates nothing; an apply is
 * refused while any row is bad.
 */
@ApiTags('v3-listing-import')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/seeded-sites/imports')
export class ListingImportController {
  constructor(private readonly imports: ListingImportService) {}

  @Get('template') @ApiOperation({ summary: 'The columns of the import file: the base columns, the staff tick columns, and one column per profile field of the category' })
  template(@Query() q: TemplateQueryDto) { return this.imports.template(q.category); }

  @Throttle(RATE.recordWrite) @Post('dry-run') @HttpCode(200) @ApiOperation({ summary: 'Check an import file row by row and report what would be created, skipped or refused. Creates nothing.' })
  dryRun(@Body() dto: ImportDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.imports.dryRun(dto.csv, { actor: actorOf(u, req), role: role(u) }); }

  @Throttle(RATE.recordWrite) @Post('apply') @HttpCode(200) @ApiOperation({ summary: 'Create the listings and draft sites of an import file on behalf of the businesses. Refused with the full report if any row is bad; rows already listed are skipped, so the same file is safe to apply twice.' })
  apply(@Body() dto: ImportDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.imports.apply(dto.csv, { actor: actorOf(u, req), role: role(u) }); }
}
