import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { SiteVersionsService } from '../versions/site-versions.service';
import { AdminRollbackSiteDto } from './dto/website.dto';

/** E11a: staff side of a site's version history. Role matrix: the list is a summary every staff role may read (no html); going back to a version is OPERATIONS, ADMIN and SUPER_ADMIN. */
@ApiTags('v3-site-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/vendors/:id/site')
export class AdminSiteVersionsController {
  constructor(private readonly versions: SiteVersionsService) {}

  @Get('revisions')
  @ApiOperation({ summary: 'The published versions of a vendor\'s site, newest first: when, by whom (a name, never an e-mail), the rollback reason, which one is live, and whether a rollback is allowed' })
  list(@Param('id') id: string, @Query() q: PageQueryDto) { return this.versions.list(id, pageArgs(q)); }

  @Post('rollback') @HttpCode(200)
  @ApiOperation({ summary: 'Go back to a published version: it is published again as a new version and the draft is reset to it. A written reason (5 to 300 characters) is required and recorded. Needs the plan\'s version history.' })
  rollback(@Param('id') id: string, @Body() dto: AdminRollbackSiteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.versions.rollback(id, dto.toVersion, dto.reason, actorOf(user, req));
  }
}
