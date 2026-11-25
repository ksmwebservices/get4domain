import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateVendorWithSiteDto } from '../v3-admin-vendor-site/admin-vendor-site.dto';
import { TelecallerService } from './telecaller.service';

/** Loose on purpose: the pure core names every problem by field. */
export class EmployeeDto { @IsOptional() name?: unknown; @IsOptional() email?: unknown; @IsOptional() phone?: unknown }
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
  @ApiOperation({ summary: 'SUPER_ADMIN: create a telecaller in one step: the staff login (invite e-mail), the commission partner linked to it, and its referral code' })
  create(@Body() dto: EmployeeDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.createEmployee(dto, { id: u?.sub ?? null as never, ip: req.ip ?? null }); }

  @Get('monitor')
  @ApiOperation({ summary: 'Every telecaller: businesses created, paid, cash waiting for the office, commission by state' })
  monitor() { return this.svc.allMonitor(); }
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

  @Post('vendors') @HttpCode(200)
  @ApiOperation({ summary: 'Create a business for an owner and a live trial site. The business is credited to me; the owner gets an e-mail link to set their own password (nobody sees a password). The duplicate override is for admins only.' })
  createBusiness(@Body() dto: CreateVendorWithSiteDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.createBusiness(u, dto, req.ip ?? null); }

  @Post('vendors/:id/collections') @HttpCode(200)
  @ApiOperation({ summary: 'Record a payment I collected: makes the CASH order for my business at the server price. It waits for an admin to confirm the cash with the receipt reference; only then the plan starts and my commission is made.' })
  collect(@Param('id') id: string, @Body() dto: CollectionDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.svc.recordCollection(u, id, dto, req.ip ?? null); }
}
