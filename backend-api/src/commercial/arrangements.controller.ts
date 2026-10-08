import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CommercialAdminGuard, MoneyAdminGuard, actorOf } from './foundation.services';
import { ArrangementFilter, ArrangementsService } from './arrangements.service';

export class CreateArrangementDto {
  @IsString() @MinLength(1) vendorId!: string;
  @IsOptional() @IsBoolean() allowHalfYear?: boolean;
  @IsOptional() @IsIn(['EXCLUSIVE', 'NONE']) gstMode?: 'EXCLUSIVE' | 'NONE';
  @IsOptional() @IsArray() @IsIn(['UPI_QR', 'OFFLINE'], { each: true }) allowedChannels?: ('UPI_QR' | 'OFFLINE')[];
  @IsString() validUntil!: string;
  @IsString() @MinLength(10) @MaxLength(300) reason!: string;
}

export class UpdateArrangementDto {
  @IsOptional() @IsBoolean() allowHalfYear?: boolean;
  @IsOptional() @IsIn(['EXCLUSIVE', 'NONE']) gstMode?: 'EXCLUSIVE' | 'NONE';
  @IsOptional() @IsArray() @IsIn(['UPI_QR', 'OFFLINE'], { each: true }) allowedChannels?: ('UPI_QR' | 'OFFLINE')[];
  @IsOptional() @IsString() validUntil?: string;
  @IsString() @MinLength(10) @MaxLength(300) reason!: string;
}

export class EndArrangementDto {
  @IsString() @MinLength(10) @MaxLength(300) reason!: string;
}

/**
 * Admin > Pricing > Special arrangements. Platform admins only: CommercialAdminGuard refuses the MARKETING staff role (and vendors, team
 * members and sandbox users) on every route; writes also sit behind MoneyAdminGuard. Every change is written to the commercial audit log.
 */
@ApiTags('admin-special-arrangements')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/special-arrangements')
export class AdminArrangementsController {
  constructor(private readonly arrangements: ArrangementsService) {}

  @Get()
  @ApiOperation({ summary: 'List special arrangements; filter all | active | expiring (next 30 days) | expired (platform admin)' })
  list(@Query('filter') filter?: string) {
    const f: ArrangementFilter = filter === 'active' || filter === 'expiring' || filter === 'expired' ? filter : 'all';
    return this.arrangements.list(f);
  }

  @Get('gst-report')
  @ApiOperation({ summary: '"GST not collected" per month and client, for the CA (platform admin)' })
  gstReport(@Query('from') from?: string, @Query('to') to?: string) { return this.arrangements.gstReport({ from, to }); }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'The active arrangement and the history for one client; used to pre-fill the deal builder (platform admin)' })
  forVendor(@Param('vendorId') vendorId: string) { return this.arrangements.forVendor(vendorId); }

  @Get(':id/history')
  @ApiOperation({ summary: 'Every change made to one arrangement (platform admin)' })
  history(@Param('id') id: string) { return this.arrangements.history(id); }

  @UseGuards(MoneyAdminGuard)
  @Post()
  @ApiOperation({ summary: 'Create a special arrangement for one client (platform admin)' })
  create(@Body() dto: CreateArrangementDto, @CurrentUser() u: AuthenticatedUser) { return this.arrangements.create(dto, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Edit an active arrangement (a reason for the change is required) (platform admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateArrangementDto, @CurrentUser() u: AuthenticatedUser) { return this.arrangements.update(id, dto, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Post(':id/end')
  @ApiOperation({ summary: 'End an arrangement now (a reason is required) (platform admin)' })
  end(@Param('id') id: string, @Body() dto: EndArrangementDto, @CurrentUser() u: AuthenticatedUser) { return this.arrangements.end(id, dto.reason, actorOf(u)); }
}
