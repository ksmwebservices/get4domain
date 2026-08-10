import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminTeamService } from './admin-team.service';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AcceptAdminInviteDto } from './dto/accept-admin-invite.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('admin-team')
@Controller('admin-team')
export class AdminTeamController {
  constructor(private readonly adminTeamService: AdminTeamService) {}

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('me')
  @ApiOperation({ summary: 'Current admin principal (role + internal adminRole)' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.sub, email: user.email, role: user.role, adminRole: user.adminRole ?? null };
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Post('invite')
  @ApiOperation({ summary: 'Invite an internal Get4Domain staff member (Super Admin only)' })
  invite(@Body() dto: InviteAdminDto) {
    return this.adminTeamService.invite(dto);
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Get('members')
  @ApiOperation({ summary: 'List internal Get4Domain staff (Super Admin only)' })
  findMembers() {
    return this.adminTeamService.findMembers();
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Put('members/:id')
  @ApiOperation({ summary: "Update a staff member's role/status (Super Admin only)" })
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminTeamService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(SuperAdminGuard)
  @Delete('members/:id')
  @ApiOperation({ summary: 'Remove a staff member (Super Admin only)' })
  remove(@Param('id') id: string) {
    return this.adminTeamService.remove(id);
  }

  @Public()
  @Post('invite/accept')
  @ApiOperation({ summary: 'Public: accept an admin team invite and set a password' })
  acceptInvite(@Body() dto: AcceptAdminInviteDto) {
    return this.adminTeamService.acceptInvite(dto);
  }
}
