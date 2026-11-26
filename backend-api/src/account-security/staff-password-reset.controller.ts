import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { StaffPasswordResetService, StaffResetAnswer, StaffResetDto } from './staff-password-reset';

@ApiTags('v3-admin-actions')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class StaffPasswordResetController {
  constructor(private readonly svc: StaffPasswordResetService) {}

  @Post('vendors/:id/send-password-reset') @HttpCode(200)
  @ApiOperation({ summary: 'E-mail the owner a password reset link (operations and super admin). Staff never set or see a password; the link goes only to the owner address.' })
  send(@Param('id') id: string, @Body() _b: StaffResetDto, @CurrentUser() _u: AuthenticatedUser, @Req() req: Request): Promise<StaffResetAnswer> { return this.svc.send(id, req.ip); }
}
