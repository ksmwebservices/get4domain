import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RequiresTab } from '../../v3-packs/requires-tab';
import { PromoKind } from '../core/gaps-core';
import { VendorGapsService } from '../vendor-gaps.service';
import { Who } from '../vendor-gaps.store';
import { DraftListDto, DraftWriteDto, MemberChangeDto, MigrationRequestDto, TeamInviteDto } from './vendor-gaps.dto';

const who = (t: TenantContext): Who => ({ type: t.actor === 'team_member' ? 'TEAM_MEMBER' : 'VENDOR', id: t.memberId ?? t.vendorId });
const ownerWho = (t: TenantContext): Who => ({ type: 'VENDOR', id: t.vendorId });

/** B3: move an existing site. Owner only. A RECORD: nothing is cut over by these routes. The migration tab is a locked preview on a Free trial (reads work, a request is refused). */
@ApiTags('v3-migration-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresTab('migration', { previewReads: true })
@Controller('v3/me/migration-requests')
export class MeMigrationController {
  constructor(private readonly gaps: VendorGapsService) {}

  @Get() @ApiOperation({ summary: 'My requests to move an existing site, newest first (record only: nothing is moved by asking)' })
  list(@Tenant() t: TenantContext) { return this.gaps.migrationRequests(t.vendorId); }

  @Throttle(RATE.recordWrite) @Post() @HttpCode(200) @ApiOperation({ summary: 'Ask us to move an existing site to your Get4Domain website. One request can be open at a time.' })
  request(@Tenant() t: TenantContext, @Body() dto: MigrationRequestDto) { return this.gaps.requestMigration(t.vendorId, dto.siteUrl, ownerWho(t)); }
}

/** B8: promotion drafts. DRAFTS ONLY: nothing is posted, scheduled or sent. A team member needs the campaigns area through the tab list; a locked tab is read only. */
@ApiTags('v3-promotion-me')
@ApiBearerAuth()
@UseTenant()
@RequiresTab('promotion', { previewReads: true })
@RequireModule('campaigns')
@Controller('v3/me/promotion/drafts')
export class MePromotionDraftsController {
  constructor(private readonly gaps: VendorGapsService) {}
  private static kind: PromoKind = 'PROMOTION';

  @Get() @ApiOperation({ summary: 'My promotion drafts, newest first' })
  list(@Tenant() t: TenantContext, @Query() q: DraftListDto) { return this.gaps.listDrafts(t.vendorId, MePromotionDraftsController.kind, q); }

  @Throttle(RATE.recordWrite) @Post() @HttpCode(200) @ApiOperation({ summary: 'Save a promotion draft (offer, announcement or festival). Nothing is posted.' })
  create(@Tenant() t: TenantContext, @Body() dto: DraftWriteDto) { return this.gaps.createDraft(t.vendorId, MePromotionDraftsController.kind, dto, who(t)); }

  @Throttle(RATE.recordWrite) @Post(':id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a draft (never deleted)' })
  archive(@Tenant() t: TenantContext, @Param('id') id: string) { return this.gaps.archiveDraft(t.vendorId, MePromotionDraftsController.kind, id); }
}

/** B8: social post drafts. DRAFTS ONLY, same rules as promotion drafts. */
@ApiTags('v3-social-me')
@ApiBearerAuth()
@UseTenant()
@RequiresTab('social', { previewReads: true })
@RequireModule('campaigns')
@Controller('v3/me/social/drafts')
export class MeSocialDraftsController {
  constructor(private readonly gaps: VendorGapsService) {}
  private static kind: PromoKind = 'SOCIAL';

  @Get() @ApiOperation({ summary: 'My social post drafts, newest first' })
  list(@Tenant() t: TenantContext, @Query() q: DraftListDto) { return this.gaps.listDrafts(t.vendorId, MeSocialDraftsController.kind, q); }

  @Throttle(RATE.recordWrite) @Post() @HttpCode(200) @ApiOperation({ summary: 'Save a social post draft for a channel. Nothing is posted.' })
  create(@Tenant() t: TenantContext, @Body() dto: DraftWriteDto) { return this.gaps.createDraft(t.vendorId, MeSocialDraftsController.kind, dto, who(t)); }

  @Throttle(RATE.recordWrite) @Post(':id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a draft (never deleted)' })
  archive(@Tenant() t: TenantContext, @Param('id') id: string) { return this.gaps.archiveDraft(t.vendorId, MeSocialDraftsController.kind, id); }
}

/**
 * B9: the vendor's team on the v3 contract. The list is readable by the owner AND by a team member (names, roles, departments and areas only: never an email, a phone or a sign-in detail); every change is
 * OWNER ONLY. The departments are the vendor's own (Sales, Support, Accounts, Marketing), not Get4Domain's staff roles. An invite is a RECORD: nothing is sent from here.
 */
@ApiTags('v3-team-me')
@ApiBearerAuth()
@UseTenant()
@Controller('v3/me/team')
export class MeTeamController {
  constructor(private readonly gaps: VendorGapsService) {}

  @Get() @ApiOperation({ summary: 'My team: name, role, department and areas, plus the department list. Readable by a team member.' })
  list(@Tenant() t: TenantContext) { return this.gaps.listTeam(t.vendorId); }

  @UseGuards(VendorOwnerGuard) @Throttle(RATE.recordWrite) @Post('invites') @HttpCode(200) @ApiOperation({ summary: 'Record an invite for a person (owner only). Nothing is sent from here.' })
  invite(@Tenant() t: TenantContext, @Body() dto: TeamInviteDto) { return this.gaps.inviteMember(t.vendorId, dto); }

  @UseGuards(VendorOwnerGuard) @Throttle(RATE.recordWrite) @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'Change a person\'s role, department or areas (owner only)' })
  change(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: MemberChangeDto) { return this.gaps.changeMember(t.vendorId, id, dto); }

  @UseGuards(VendorOwnerGuard) @Throttle(RATE.recordWrite) @Post(':id/deactivate') @HttpCode(200) @ApiOperation({ summary: 'Stop a person signing in; their record is kept (owner only)' })
  deactivate(@Tenant() t: TenantContext, @Param('id') id: string) { return this.gaps.setMemberActive(t.vendorId, id, false); }

  @UseGuards(VendorOwnerGuard) @Throttle(RATE.recordWrite) @Post(':id/reactivate') @HttpCode(200) @ApiOperation({ summary: 'Let a deactivated person sign in again (owner only)' })
  reactivate(@Tenant() t: TenantContext, @Param('id') id: string) { return this.gaps.setMemberActive(t.vendorId, id, true); }
}
