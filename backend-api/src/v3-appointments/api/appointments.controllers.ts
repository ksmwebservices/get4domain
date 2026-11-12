import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { AppointmentsService } from '../appointments.service';
import { APPT_STATES } from '../core/appointments-core';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class ArchivedListDto extends PageDto { @IsOptional() @IsBoolean() @Type(() => Boolean) includeArchived?: boolean }
export class CreateServiceDto {
  @IsString() @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(5) @Max(480) durationMin!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pricePaise?: number;
}
export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(480) durationMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pricePaise?: number;
}
export class CreateProviderDto { @IsString() @MaxLength(120) name!: string; @IsOptional() @IsArray() hours?: unknown[] }
export class UpdateProviderDto { @IsOptional() @IsString() @MaxLength(120) name?: string; @IsOptional() @IsArray() hours?: unknown[] }
export class AvailabilityDto { @IsString() @MaxLength(40) serviceId!: string; @IsString() @MaxLength(40) providerId!: string; @Matches(DAY) day!: string }
export class BookingListDto extends PageDto {
  @IsOptional() @IsIn([...APPT_STATES]) status?: string;
  @IsOptional() @IsString() @MaxLength(40) providerId?: string;
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
}
export class RequestBookingDto {
  @IsString() @MaxLength(40) serviceId!: string;
  @IsString() @MaxLength(40) providerId!: string;
  @IsString() @MaxLength(40) startsAt!: string;
  @IsString() @MaxLength(120) customerName!: string;
  @IsOptional() @IsString() @MaxLength(20) customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(40) requestId?: string;
}
export class ReasonDto { @IsOptional() @IsString() @MaxLength(300) reason?: string }

/** Appointments of a Professional business. OWNER ONLY for now (customer details; staff access arrives with the team slice), plan feature `appointments.manage` (Free sees it locked; other tracks do not see it). */
@ApiTags('v3-appointments-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('appointments.manage')
@Controller('v3/me/appointments')
export class MeAppointmentsController {
  constructor(private readonly appts: AppointmentsService) {}

  @Get('services') @ApiOperation({ summary: 'Services offered by appointment' })
  async services(@Tenant() t: TenantContext, @Query() q: ArchivedListDto) { const { page, pageSize } = pageArgs(q); const r = await this.appts.listServices(t.vendorId, q.includeArchived === true, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('services') @HttpCode(200) @ApiOperation({ summary: 'Add a service with its length' })
  addService(@Tenant() t: TenantContext, @Body() dto: CreateServiceDto) { return this.appts.createService(t.vendorId, dto); }
  @Put('services/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a service' })
  changeService(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateServiceDto) { return this.appts.updateService(t.vendorId, id, dto); }
  @Post('services/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a service (never deleted)' })
  archiveService(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.archiveService(t.vendorId, id, true); }
  @Post('services/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived service back' })
  restoreService(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.archiveService(t.vendorId, id, false); }

  @Get('providers') @ApiOperation({ summary: 'People who take appointments, with their weekly hours' })
  async providers(@Tenant() t: TenantContext, @Query() q: ArchivedListDto) { const { page, pageSize } = pageArgs(q); const r = await this.appts.listProviders(t.vendorId, q.includeArchived === true, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('providers') @HttpCode(200) @ApiOperation({ summary: 'Add a provider with working hours (India time)' })
  addProvider(@Tenant() t: TenantContext, @Body() dto: CreateProviderDto) { return this.appts.createProvider(t.vendorId, dto); }
  @Put('providers/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a provider or the working hours' })
  changeProvider(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateProviderDto) { return this.appts.updateProvider(t.vendorId, id, dto); }
  @Post('providers/:id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a provider (never deleted)' })
  archiveProvider(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.archiveProvider(t.vendorId, id, true); }
  @Post('providers/:id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived provider back' })
  restoreProvider(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.archiveProvider(t.vendorId, id, false); }

  @Get('slots') @ApiOperation({ summary: 'Free start times of a provider for a service on a day' })
  slots(@Tenant() t: TenantContext, @Query() q: AvailabilityDto) { return this.appts.availability(t.vendorId, q); }
  @Get() @ApiOperation({ summary: 'Requests and appointments in time order; filter by status, provider or days' })
  async list(@Tenant() t: TenantContext, @Query() q: BookingListDto) { const { page, pageSize } = pageArgs(q); const r = await this.appts.listBookings(t.vendorId, q, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get(':id') @ApiOperation({ summary: 'One request or appointment' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.getBooking(t.vendorId, id); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Record a customer request for a free time; it stays REQUESTED until you confirm' })
  request(@Tenant() t: TenantContext, @Body() dto: RequestBookingDto) { return this.appts.requestBooking(t.vendorId, dto); }
  @Post(':id/confirm') @HttpCode(200) @ApiOperation({ summary: 'Confirm a request (only you can; nothing confirms itself)' })
  confirm(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.confirm(t.vendorId, id); }
  @Post(':id/decline') @HttpCode(200) @ApiOperation({ summary: 'Decline a request' })
  decline(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.decline(t.vendorId, id); }
  @Post(':id/cancel') @HttpCode(200) @ApiOperation({ summary: 'Cancel a request or an appointment, with a reason' })
  cancel(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: ReasonDto) { return this.appts.cancel(t.vendorId, id, dto.reason); }
  @Post(':id/complete') @HttpCode(200) @ApiOperation({ summary: 'Mark a confirmed appointment done' })
  complete(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.complete(t.vendorId, id); }
  @Post(':id/no-show') @HttpCode(200) @ApiOperation({ summary: 'Mark a confirmed appointment as a no-show' })
  noShow(@Tenant() t: TenantContext, @Param('id') id: string) { return this.appts.noShow(t.vendorId, id); }
}
