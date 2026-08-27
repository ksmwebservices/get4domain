import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GymClass, Membership } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { GymService, GymSummary } from './gym.service';
import { CreateGymClassDto, UpdateGymClassDto, CreateMembershipDto, UpdateMembershipDto } from './dto/gym.dto';

@ApiTags('gym')
@ApiBearerAuth()
@Controller('gym')
export class GymController {
  constructor(private readonly service: GymService) {}

  @Get('summary') @ApiOperation({ summary: 'Gym membership summary (active/expiring, revenue by plan)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<GymSummary> { return this.service.summary(u.sub); }

  @Get('classes') listClasses(@CurrentUser() u: AuthenticatedUser): Promise<GymClass[]> { return this.service.listClasses(u.sub); }
  @Post('classes') createClass(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateGymClassDto): Promise<GymClass> { return this.service.createClass(u.sub, d); }
  @Patch('classes/:id') updateClass(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateGymClassDto): Promise<GymClass> { return this.service.updateClass(u.sub, id, d); }
  @Delete('classes/:id') deleteClass(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<GymClass> { return this.service.deleteClass(u.sub, id); }

  @Get('memberships') listMemberships(@CurrentUser() u: AuthenticatedUser): Promise<Membership[]> { return this.service.listMemberships(u.sub); }
  @Post('memberships') createMembership(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateMembershipDto): Promise<Membership> { return this.service.createMembership(u.sub, d); }
  @Patch('memberships/:id') updateMembership(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateMembershipDto): Promise<Membership> { return this.service.updateMembership(u.sub, id, d); }
  @Delete('memberships/:id') deleteMembership(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<Membership> { return this.service.deleteMembership(u.sub, id); }
}
