import { Body, Controller, Get, HttpCode, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsObject } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PageQueryDto, pageArgs } from '../plans/admin/plans-admin.common';
import { DraftBrandDto, DraftFieldDto, DraftListDto, DraftNavigationDto, DraftSectionsDto } from '../v3-website/api/dto/website.dto';
import { staffOf } from '../v3-website/api/staff-ref';
import { AdminDraftService, StaffWrite } from './admin-draft.service';

export class AdminDraftProfileDto { @IsObject() values!: Record<string, unknown> }
export class AdminDraftHoursDto { @IsArray() hours!: unknown[] }

type StaffRequest = Request & { actOnBehalf?: { sessionId: string } };
const write = (user: AuthenticatedUser, req: StaffRequest): StaffWrite => ({ staff: staffOf(user), actor: { type: 'STAFF', id: user.sub, ip: req.ip ?? null }, sessionId: req.actOnBehalf?.sessionId ?? null });

/** E11b: the items of a business, for staff who edit its item pages. The same roles as reading the draft. */
@ApiTags('v3-website-draft-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/vendors/:id')
export class AdminItemsController {
  constructor(private readonly drafts: AdminDraftService) {}

  @Get('items')
  @ApiOperation({ summary: 'The items of a business (hidden ones too), oldest first, with which already have an item page, and the list of every item page in the draft. A telecaller only for a business that telecaller created.' })
  items(@Param('id') id: string, @Query() q: PageQueryDto, @CurrentUser() u: AuthenticatedUser) { return this.drafts.items(staffOf(u), id, pageArgs(q)); }
}

/**
 * E9a: the staff twin of every PUT /v3/me/site/draft/* route, plus profile details and opening hours. OPERATIONS, ADMIN and SUPER_ADMIN; a TELECALLER only for a business that telecaller created.
 * A change needs a live act-on-behalf session for that business, named in the x-act-on-behalf-session header. The bodies are the same as on the owner's routes.
 */
@ApiTags('v3-website-draft-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/vendors/:id/site')
export class AdminDraftController {
  constructor(private readonly drafts: AdminDraftService) {}

  @Get('draft')
  @ApiOperation({ summary: 'The draft of a business: read it before saving a list, the brand, the hours or the location, because those replace the whole thing' })
  draft(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.drafts.draft(staffOf(u), id); }

  @Get('editor/map')
  @ApiOperation({ summary: 'What can be edited on the site of a business: the pages and sections of its theme, the typed fields and the plan limits' })
  editor(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.drafts.editor(staffOf(u), id); }

  @Put('draft/field') @HttpCode(200)
  @ApiOperation({ summary: 'Save one text, link or picture field on behalf of a business (a picture is the link of one of its uploads)' })
  field(@Param('id') id: string, @Body() dto: DraftFieldDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'field', key: dto.key, value: dto.value }); }

  @Put('draft/list/:name') @HttpCode(200)
  @ApiOperation({ summary: 'Save one whole list on behalf of a business: questions, gallery, steps, team, branches, groups, areas, offers, extra sections or item pages (itemDetails)' })
  list(@Param('id') id: string, @Param('name') name: string, @Body() dto: DraftListDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'list', name, items: dto.items }); }

  @Put('draft/sections') @HttpCode(200)
  @ApiOperation({ summary: 'Show, hide and reorder sections on behalf of a business' })
  sections(@Param('id') id: string, @Body() dto: DraftSectionsDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'sections', value: { hidden: dto.hidden, order: dto.order } }); }

  @Put('draft/brand') @HttpCode(200)
  @ApiOperation({ summary: 'Brand on behalf of a business: accent colours, fonts and the logo. REPLACES the whole brand: send every setting to keep.' })
  brand(@Param('id') id: string, @Body() dto: DraftBrandDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'brand', value: dto.brand }); }

  @Put('draft/navigation') @HttpCode(200)
  @ApiOperation({ summary: 'Header and footer menus on behalf of a business' })
  navigation(@Param('id') id: string, @Body() dto: DraftNavigationDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'navigation', value: { header: dto.header, footer: dto.footer } }); }

  @Put('draft/seo/:pageKey') @HttpCode(200)
  @ApiOperation({ summary: 'The search-result title, description and share picture of one page, on behalf of a business' })
  seo(@Param('id') id: string, @Param('pageKey') pageKey: string, @Body() body: Record<string, unknown>, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'seo', pageKey, edit: body }); }

  @Put('draft/location') @HttpCode(200)
  @ApiOperation({ summary: 'The location on behalf of a business. REPLACES the whole location: send every part to keep.' })
  location(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'location', value: body }); }

  @Put('draft/review-link') @HttpCode(200)
  @ApiOperation({ summary: 'The Google review link on behalf of a business (Pro only; an empty value removes it)' })
  reviewLink(@Param('id') id: string, @Body() body: { url?: unknown }, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'reviewLink', value: body?.url }); }

  @Put('draft/testimonials') @HttpCode(200)
  @ApiOperation({ summary: 'Testimonials on behalf of a business, under the same rules: first name or initials, a confirmation that the customer agreed, no ratings; Pro only' })
  testimonials(@Param('id') id: string, @Body() body: { items?: unknown }, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'testimonials', items: body?.items }); }

  @Put('draft/hours') @HttpCode(200)
  @ApiOperation({ summary: 'Opening hours on behalf of a business, one row a day. REPLACES the whole week; an empty list clears the hours.' })
  hours(@Param('id') id: string, @Body() dto: AdminDraftHoursDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.save(write(u, req), id, { kind: 'hours', value: dto.hours }); }

  @Put('draft/profile') @HttpCode(200)
  @ApiOperation({ summary: 'Profile details on behalf of a business (owner name, year, opening hours and the fields of its category), written into the draft by the field map. Only the fields sent change.' })
  profile(@Param('id') id: string, @Body() dto: AdminDraftProfileDto, @CurrentUser() u: AuthenticatedUser, @Req() req: StaffRequest) { return this.drafts.saveProfile(write(u, req), id, dto.values); }
}
