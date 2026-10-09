import { BadRequestException, Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CommercialAdminGuard, CommercialAuditService, actorOf } from '../commercial/foundation.services';
import { EntitlementsService } from './entitlements.service';
import type { PlanKey } from '../registry/registry.generated';

export class CapabilityOverrideDto {
  @IsOptional() @IsIn(['WORKSPACE', 'BOS', 'CUSTOM']) minPlan?: PlanKey;
  /** { seats: { WORKSPACE: 1, BOS: 5 } } - null means unlimited. */
  @IsOptional() @IsObject() limits?: Record<string, Partial<Record<PlanKey, number | null>>>;
  @IsOptional() @IsBoolean() reset?: boolean;
  @IsString() @MinLength(10, { message: 'Write a short reason (at least 10 characters) so the change can be understood later.' }) @MaxLength(300) reason!: string;
}
export class VendorCapabilityDto {
  @IsString() @MaxLength(60) capabilityId!: string;
  /** true = switch on, false = switch off, null = remove the exception (the plan decides again). */
  @IsOptional() @IsBoolean() enabled?: boolean | null;
  @IsString() @MinLength(10, { message: 'Write a short reason (at least 10 characters) so the change can be understood later.' }) @MaxLength(300) reason!: string;
}

/** Admin: what each plan switches on (the editable split) and per-vendor exceptions. Platform admins only; MARKETING is refused. */
@ApiTags('admin-bos-entitlements')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/bos')
export class BosAdminController {
  constructor(private readonly ent: EntitlementsService, private readonly audit: CommercialAuditService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Every plan-gated capability with its minimum plan and limits (registry default merged with any override)' })
  async table() {
    return (await this.ent.table()).map((t) => ({ id: t.capability.id, label: t.capability.label, minPlan: t.minPlan, defaultMinPlan: t.capability.minPlan, limits: t.limits, overridden: t.overridden }));
  }

  @Put('capabilities/:id')
  @ApiOperation({ summary: 'Change which plan includes a capability, or its limits (audited)' })
  async override(@Param('id') id: string, @Body() dto: CapabilityOverrideDto, @CurrentUser() u: AuthenticatedUser) {
    if (!dto.reset && !dto.minPlan && !dto.limits) throw new BadRequestException('Choose the plan or the limit to change.');
    await this.ent.setOverride(id, dto, actorOf(u).id);
    await this.audit.log(actorOf(u), 'plan.capability.override', 'Capability', id, { ...dto });
    return this.table();
  }

  @Get('vendors/:vendorId/entitlements')
  @ApiOperation({ summary: "What one vendor's plan, arrangements and exceptions switch on" })
  vendor(@Param('vendorId') vendorId: string) { return this.ent.resolve(vendorId); }

  @Post('vendors/:vendorId/capability')
  @ApiOperation({ summary: 'Switch one capability on or off for one vendor, with a reason (audited)' })
  async exception(@Param('vendorId') vendorId: string, @Body() dto: VendorCapabilityDto, @CurrentUser() u: AuthenticatedUser) {
    await this.ent.setVendorException(vendorId, dto.capabilityId, dto.enabled === undefined ? null : dto.enabled);
    await this.audit.log(actorOf(u), 'plan.capability.exception', 'Vendor', vendorId, { capabilityId: dto.capabilityId, enabled: dto.enabled ?? null, reason: dto.reason });
    return this.ent.resolve(vendorId);
  }
}
