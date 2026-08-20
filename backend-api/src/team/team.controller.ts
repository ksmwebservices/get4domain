import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../common/guards/vendor-owner.guard';

@ApiTags('team')
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @ApiBearerAuth()
  @UseGuards(VendorOwnerGuard)
  @Post('invite')
  @ApiOperation({ summary: 'Invite a team member (owner only; sends email/WhatsApp invite)' })
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteMemberDto) {
    return this.teamService.invite(user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('members')
  @ApiOperation({ summary: "List the current vendor's team members" })
  findMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.findMembers(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(VendorOwnerGuard)
  @Put('members/:id')
  @ApiOperation({ summary: "Update a team member's role/modules (owner only)" })
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMemberDto) {
    return this.teamService.update(id, user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(VendorOwnerGuard)
  @Delete('members/:id')
  @ApiOperation({ summary: 'Remove a team member (owner only)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teamService.remove(id, user.sub);
  }

  @Public()
  @Post('invite/accept')
  @ApiOperation({ summary: 'Public: accept a team invite and set a password' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.teamService.acceptInvite(dto);
  }

  @ApiBearerAuth()
  @Get('activity')
  @ApiOperation({ summary: 'Recent team activity (status and last login per member)' })
  activity(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.activity(user.sub);
  }
}
