import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConstructionProject, ProjectMilestone, ProjectMaterial } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ConstructionService, ConstructionSummary } from './construction.service';
import {
  CreateProjectDto, UpdateProjectDto,
  CreateMilestoneDto, UpdateMilestoneDto,
  CreateMaterialDto, UpdateMaterialDto,
} from './dto/construction.dto';

@ApiTags('construction')
@ApiBearerAuth()
@Controller('construction')
export class ConstructionController {
  constructor(private readonly service: ConstructionService) {}

  @Get('summary') @ApiOperation({ summary: 'Construction summary (active projects, value, milestones)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<ConstructionSummary> { return this.service.summary(u.sub); }

  @Get('projects') listProjects(@CurrentUser() u: AuthenticatedUser): Promise<ConstructionProject[]> { return this.service.listProjects(u.sub); }
  @Get('projects/:id') getProject(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ConstructionProject> { return this.service.getProject(u.sub, id); }
  @Post('projects') createProject(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateProjectDto): Promise<ConstructionProject> { return this.service.createProject(u.sub, d); }
  @Patch('projects/:id') updateProject(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateProjectDto): Promise<ConstructionProject> { return this.service.updateProject(u.sub, id, d); }
  @Delete('projects/:id') deleteProject(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ConstructionProject> { return this.service.deleteProject(u.sub, id); }

  @Post('projects/:id/milestones') addMilestone(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: CreateMilestoneDto): Promise<ProjectMilestone> { return this.service.addMilestone(u.sub, id, d); }
  @Patch('milestones/:id') updateMilestone(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateMilestoneDto): Promise<ProjectMilestone> { return this.service.updateMilestone(u.sub, id, d); }
  @Delete('milestones/:id') deleteMilestone(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ProjectMilestone> { return this.service.deleteMilestone(u.sub, id); }

  @Get('materials') listMaterials(@CurrentUser() u: AuthenticatedUser): Promise<ProjectMaterial[]> { return this.service.listMaterials(u.sub); }
  @Post('materials') createMaterial(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateMaterialDto): Promise<ProjectMaterial> { return this.service.createMaterial(u.sub, d); }
  @Patch('materials/:id') updateMaterial(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateMaterialDto): Promise<ProjectMaterial> { return this.service.updateMaterial(u.sub, id, d); }
  @Delete('materials/:id') deleteMaterial(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ProjectMaterial> { return this.service.deleteMaterial(u.sub, id); }
}
