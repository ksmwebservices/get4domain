import { Body, Controller, Get, Header, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CommercialAdminGuard } from '../commercial/foundation.services';
import { AdSpendDto, ApproveJobsDto, CalendarDto, CapsDto, ChangeRequestDto, EditJobDto, PromotionPlanDto, RejectJobDto, SwitchDto } from './leadspace.dto';
import { PromotionService } from './promotion.service';
import { LeadspaceReportsService } from './reports.service';
import { LeadspaceSettingsService } from './settings.service';
import { LeadspaceStaffGuard } from './staff.guard';

const lastDays = (n: number): string => new Date(Date.now() - (n - 1) * 86_400_000).toISOString().slice(0, 10);
const today = (): string => new Date().toISOString().slice(0, 10);

/** Vendor: switch promotion on or off, choose where and how often, see the schedule and results (read only), ask for a change. */
@ApiTags('leadspace')
@ApiBearerAuth()
@RequireModule('campaigns')
@Controller('leadspace/promote')
export class LeadspacePromoteVendorController {
  constructor(private readonly promo: PromotionService, private readonly reports: LeadspaceReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Promote tab: plan on or off, the schedule, the posts and their results (read only)' })
  view(@CurrentUser() u: AuthenticatedUser) { return this.promo.vendorView(u.sub); }

  @Put()
  @ApiOperation({ summary: 'Turn promotion on or off, choose places and posts a week, set the offer to promote' })
  plan(@CurrentUser() u: AuthenticatedUser, @Body() dto: PromotionPlanDto) { return this.promo.setPlan(u.sub, dto); }

  @Post('calendar')
  @ApiOperation({ summary: 'Write the next month of posts. Our team approves them at first.' })
  calendar(@CurrentUser() u: AuthenticatedUser, @Body() dto: CalendarDto) { return this.promo.generateCalendar(u.sub, dto, u.sub); }

  @Post('change-request')
  @ApiOperation({ summary: 'Ask our team to change the plan or a post' })
  change(@CurrentUser() u: AuthenticatedUser, @Body() dto: ChangeRequestDto) { return this.promo.requestChange(u.sub, dto.text); }

  @Get('funnel')
  @ApiOperation({ summary: 'Your funnel: views, button taps, forms, verified events, held, delivered, won, credited, with the cost per verified event' })
  funnel(@CurrentUser() u: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.funnel(u.sub, from ?? lastDays(30), to ?? today()); }
}

/** Admin (any staff, including MARKETING): the approval queue, manual tasks, kill switches. */
@ApiTags('admin-leadspace')
@ApiBearerAuth()
@UseGuards(LeadspaceStaffGuard)
@Controller('admin/leadspace/promotion')
export class LeadspacePromotionAdminController {
  constructor(private readonly promo: PromotionService, private readonly settings: LeadspaceSettingsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Every vendor plan with its post counts' })
  plans() { return this.promo.adminPlans(); }

  @Get('queue')
  @ApiOperation({ summary: 'Posts waiting for approval (or another status)' })
  queue(@Query('status') status?: string, @Query('vendorId') vendorId?: string) { return this.promo.queue({ status, vendorId }); }

  @Post('approve')
  @ApiOperation({ summary: 'Approve posts; the ones for a connected account are scheduled at once' })
  approve(@Body() dto: ApproveJobsDto, @CurrentUser() u: AuthenticatedUser) { return this.promo.approve(dto.ids, u.email || u.sub); }

  @Put('jobs/:id/reject')
  @ApiOperation({ summary: 'Reject a post with a reason' })
  reject(@Param('id') id: string, @Body() dto: RejectJobDto, @CurrentUser() u: AuthenticatedUser) { return this.promo.reject(id, u.email || u.sub, dto.note); }

  @Put('jobs/:id/edit')
  @ApiOperation({ summary: 'Edit the text of a post waiting for approval (checked against the guardrails again)' })
  edit(@Param('id') id: string, @Body() dto: EditJobDto, @CurrentUser() u: AuthenticatedUser) { return this.promo.editCopy(id, u.email || u.sub, dto.caption); }

  @Get('tasks')
  @ApiOperation({ summary: 'Manual task list: Facebook Groups and Google Business Profile posts with the copy ready to paste' })
  tasks(@Query('done') done?: string) { return this.promo.tasks(done === 'true'); }

  @Post('tasks/:id/done')
  @ApiOperation({ summary: 'Mark a manual task done' })
  done(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.promo.markDone(id, u.email || u.sub); }

  @Put('vendors/:vendorId/kill')
  @ApiOperation({ summary: 'Kill switch for one vendor: cancels waiting posts and keeps promotion off until resumed' })
  kill(@Param('vendorId') vendorId: string, @Body() dto: SwitchDto, @CurrentUser() u: AuthenticatedUser) { return this.promo.setKill(vendorId, dto.on, u.email || u.sub); }

  @Put('vendors/:vendorId/auto-approve')
  @ApiOperation({ summary: "After the first weeks, let this vendor's posts go out without approval" })
  auto(@Param('vendorId') vendorId: string, @Body() dto: SwitchDto) { return this.promo.setAutoApprove(vendorId, dto.on); }

  @Get('status')
  @ApiOperation({ summary: 'The global kill switch and the daily post caps per channel' })
  async status() { const s = await this.settings.get(); return { globalKillSwitch: s.globalKillSwitch, channelDailyCaps: s.channelDailyCaps }; }

  @Put('caps')
  @ApiOperation({ summary: 'Daily post caps per account, by channel' })
  async caps(@Body() dto: CapsDto, @CurrentUser() u: AuthenticatedUser) { return { channelDailyCaps: (await this.settings.set('channelDailyCaps', dto.caps, u.email || u.sub)).channelDailyCaps }; }

  @Put('global-kill')
  @ApiOperation({ summary: 'Global kill switch: nothing is posted for anyone while it is on' })
  async globalKill(@Body() dto: SwitchDto, @CurrentUser() u: AuthenticatedUser) { return { globalKillSwitch: (await this.settings.set('globalKillSwitch', dto.on, u.email || u.sub)).globalKillSwitch }; }

  @Get('sitemap-task')
  @ApiOperation({ summary: 'Guided task: submit the LeadSpace sitemap in Google Search Console' })
  sitemap() { return this.promo.sitemapTask(); }

  @Post('sitemap-task/done')
  @ApiOperation({ summary: 'Record that the sitemap was submitted' })
  sitemapDone(@CurrentUser() u: AuthenticatedUser) { return this.promo.sitemapDone(u.email || u.sub); }

  @Post('run')
  @ApiOperation({ summary: 'Schedule what is approved and bring the job list up to date with the publisher' })
  async run() { const scheduled = await this.promo.scheduleApproved(); const synced = await this.promo.sync(); return { scheduled, synced }; }
}

/** Admin money reports: ad spend we entered, cost per verified lead, margin alerts. Platform admins only; MARKETING is refused. */
@ApiTags('admin-leadspace')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/leadspace')
export class LeadspaceReportsAdminController {
  constructor(private readonly reports: LeadspaceReportsService) {}

  @Get('cost-report')
  @ApiOperation({ summary: 'Cost per verified lead by trade and city, from ad spend entries and events, with margin alerts below the floor' })
  cost(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.costReport(from ?? lastDays(30), to ?? today()); }

  @Get('test-campaign-sheet')
  @ApiOperation({ summary: 'Test ads sheet: per UTM campaign, the verified leads, the spend recorded for it and the cost per verified lead' })
  sheet(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.utmSheet(from ?? lastDays(30), to ?? today()); }

  @Get('test-campaign-sheet.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leadspace-test-campaigns.csv"')
  @ApiOperation({ summary: 'The same sheet as a CSV file' })
  async sheetCsv(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.csvSheet((await this.reports.utmSheet(from ?? lastDays(30), to ?? today())).rows); }

  @Get('ad-spend')
  @ApiOperation({ summary: 'Ad spend entries' })
  list(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.listSpend(from, to); }

  @Post('ad-spend')
  @ApiOperation({ summary: 'Record money our team spent boosting posts (entered by hand)' })
  add(@Body() dto: AdSpendDto, @CurrentUser() u: AuthenticatedUser) { return this.reports.addSpend(dto, u.email || u.sub); }

  @Put('ad-spend/:id/remove')
  @ApiOperation({ summary: 'Remove a mistaken entry' })
  remove(@Param('id') id: string) { return this.reports.removeSpend(id); }

  @Get('vendors/:vendorId/funnel')
  @ApiOperation({ summary: "One vendor's funnel" })
  funnel(@Param('vendorId') vendorId: string, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.funnel(vendorId, from ?? lastDays(30), to ?? today()); }
}
