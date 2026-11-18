import { Body, Controller, Get, Param, ParseIntPipe, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { MAX_ALLOWANCE } from './included-core';
import { IncludedAllowanceService } from './included-allowance.service';

export class SetAllowanceDto {
  /** a whole number, or null to clear it back to "not set" */
  @ValidateIf((_o, v) => v !== null) @IsInt() @Min(1) @Max(MAX_ALLOWANCE) @IsOptional() quantity!: number | null;
}

/** B3.3: what each paid plan includes of each service group, per billing term. Read: OPERATIONS and SUPER_ADMIN. Write: SUPER_ADMIN only. Nothing is set until the owner decides. */
@ApiTags('v3-included-services-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/included-services')
export class IncludedServicesAdminController {
  constructor(private readonly included: IncludedAllowanceService) {}

  @Get() @ApiOperation({ summary: 'Every paid plan by its billing terms and the six service groups: a quantity, or NOT_SET' })
  matrix() { return this.included.matrix(); }

  @Put(':planKey/:termMonths/:groupKey') @ApiOperation({ summary: 'Set how many of a service group a plan includes on a billing term; quantity null clears it to NOT_SET (SUPER_ADMIN, audited)' })
  set(@Param('planKey') planKey: string, @Param('termMonths', ParseIntPipe) termMonths: number, @Param('groupKey') groupKey: string, @Body() dto: SetAllowanceDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.included.set(planKey, termMonths, groupKey, dto.quantity === undefined ? null : dto.quantity, actorOf(user, req));
  }
}
