import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PageQueryDto, pageArgs, paged } from '../plans/admin/plans-admin.common';
import { CreateVendorWithSiteDto } from '../v3-admin-vendor-site/admin-vendor-site.dto';
import { TelecallerService } from './telecaller.service';

/** Loose on purpose: the pure core names every problem by field. */
export class EmployeeDto { @IsOptional() name?: unknown; @IsOptional() email?: unknown; @IsOptional() phone?: unknown; @IsOptional() payType?: unknown; @IsOptional() monthlySalaryMinor?: unknown }
export class PayDto { @IsOptional() payType?: unknown; @IsOptional() monthlySalaryMinor?: unknown }
export class CollectionDto {
  @IsString() @Length(2, 60) planKey!: string;
  @IsInt() @Min(1) @Max(120) termMonths!: number;
  @IsString() @Length(8, 80) @MaxLength(80) idempotencyKey!: string;
}

/** Admin side: create telecaller accounts and watch them. */
@ApiTags('v3-telecaller-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/telecallers')
export class AdminTelecallerController {
  constructor(private readonly svc: TelecallerService) {}

  @Post() @HttpCode(200)
  @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN: create a telecaller in one step: the staff login (invite e-mail), the commission partner linked to it, its referral code and, optionally, the pay type (payType: SALARY_PLUS_COMMISSION or FREELANCE_SLAB)' })
  create(@Body() dto: EmployeeDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.createEmployee(dto, { id: u?.sub ?? null as never, ip: req.ip ?? null }); }

  @Get('monitor')
  @ApiOperation({ summary: 'Every telecaller: pay type, businesses created, paid, cash waiting for the office and overdue, commission by state' })
  monitor() { return this.svc.allMonitor(); }

  @Get('settings')
  @ApiOperation({ summary: 'The telecaller settings in force: the daily cap of new businesses and the days after which unconfirmed cash is overdue (SUPER_ADMIN changes them on PUT /v3/admin/plan-settings/:key)' })
  settings() { return this.svc.settingsView(); }

  @Get(':partnerId/pay')
  @ApiOperation({ summary: 'SUPER_ADMIN: the pay setting of one telecaller (pay type and monthly salary in paise)' })
  pay(@Param('partnerId') partnerId: string) { return this.svc.payOf(partnerId); }

  @Put(':partnerId/pay') @HttpCode(200)
  @ApiOperation({ summary: 'SUPER_ADMIN: set how one telecaller is paid. REPLACES the setting: a salary left out is cleared; a freelancer has none. Commission tiers are the commission slab rows.' })
  setPay(@Param('partnerId') partnerId: string, @Body() dto: PayDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.setPay(partnerId, dto, { id: u?.sub ?? null as never, ip: req.ip ?? null }); }
}

/** The telecaller's own side. A login that is not a telecaller gets NOT_A_TELECALLER. */
@ApiTags('v3-telecaller')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/telecaller')
export class TelecallerSelfController {
  constructor(private readonly svc: TelecallerService) {}

  @Get('monitor')
  @ApiOperation({ summary: 'My numbers: businesses I created, how many have paid, cash waiting for the office, my commission by state' })
  monitor(@CurrentUser() u: AuthenticatedUser) { return this.svc.myMonitor(u); }

  @Get('vendors')
  @ApiOperation({ summary: 'The businesses I created (only mine), newest first, each with where its website stands: LIVE, PREVIEW_ONLY, FAILED, NOT_BUILT or REMOVED. No owner name, e-mail or phone.' })
  async myBusinesses(@CurrentUser() u: AuthenticatedUser, @Query() q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.svc.myBusinesses(u, { skip, take });
    return paged(r.items, r.total, page, pageSize);
  }

  @Post('vendors') @HttpCode(200)
  @ApiOperation({ summary: 'Create a business for an owner and a live trial site. The business is credited to me; the owner gets an e-mail link to set their own password (nobody sees a password). The duplicate override is for admins only.' })
  createBusiness(@Body() dto: CreateVendorWithSiteDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.createBusiness(u, dto, req.ip ?? null); }

  @Post('vendors/:id/pay-links') @HttpCode(200)
  @ApiOperation({ summary: 'A payment link for my business at the server price, to share with the owner (test mode only, off until staff switch it on). When it is paid the plan starts and my commission is made, as for any payment.' })
  payLink(@Param('id') id: string, @Body() dto: CollectionDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.payLink(u, id, dto, req.ip ?? null); }

  @Post('vendors/:id/collections') @HttpCode(200)
  @ApiOperation({ summary: 'Record a payment I collected: makes the CASH order for my business at the server price. It waits for an admin to confirm the cash with the receipt reference; only then the plan starts and my commission is made.' })
  collect(@Param('id') id: string, @Body() dto: CollectionDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.recordCollection(u, id, dto, req.ip ?? null); }
}
