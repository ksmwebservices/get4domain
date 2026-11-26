import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { actorOf } from '../plans/admin/plans-admin.common';
import { ContentPackService, ImportReport } from './content-pack.service';

export class ImportContentPackDto {
  /** the content.json of a pack (schema g4d-pack-content/1) */
  @IsObject() pack!: Record<string, unknown>;
  /** true = write nothing, return what would be written and what would be skipped */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

@ApiTags('v3-content-pack')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class ContentPackController {
  constructor(private readonly packs: ContentPackService) {}

  @Post('vendors/:id/content-pack/import') @HttpCode(200)
  @ApiOperation({ summary: 'Load a content pack (content.json) into a business: default wording (one variant chosen by the business id), groups, services as starter items, FAQs, trust points, steps, areas, extra sections and item page details. Never overwrites anything the business already has. dryRun=true writes nothing.' })
  import(@Param('id') id: string, @Body() dto: ImportContentPackDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request): Promise<ImportReport> {
    return this.packs.import(String(id).slice(0, 64), dto.pack, actorOf(u, req), { dryRun: dto.dryRun === true });
  }
}
