import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TechProject, ProjectTask } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TechnologyService, TechnologySummary } from './technology.service';
import {
  CreateProjectDto, UpdateProjectDto,
  CreateTaskDto, UpdateTaskDto,
} from './dto/technology.dto';

@ApiTags('technology')
@ApiBearerAuth()
@Controller('technology')
export class TechnologyController {
  constructor(private readonly service: TechnologyService) {}

  @Get('summary') @ApiOperation({ summary: 'Technology summary (active projects, value, tasks)' })
  summary(@CurrentUser() u: AuthenticatedUser): Promise<TechnologySummary> { return this.service.summary(u.sub); }

  @Get('projects') listProjects(@CurrentUser() u: AuthenticatedUser): Promise<TechProject[]> { return this.service.listProjects(u.sub); }
  @Post('projects') createProject(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateProjectDto): Promise<TechProject> { return this.service.createProject(u.sub, d); }
  @Patch('projects/:id') updateProject(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateProjectDto): Promise<TechProject> { return this.service.updateProject(u.sub, id, d); }
  @Delete('projects/:id') deleteProject(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<TechProject> { return this.service.deleteProject(u.sub, id); }

  @Get('tasks') listTasks(@CurrentUser() u: AuthenticatedUser): Promise<ProjectTask[]> { return this.service.listTasks(u.sub); }
  @Post('tasks') createTask(@CurrentUser() u: AuthenticatedUser, @Body() d: CreateTaskDto): Promise<ProjectTask> { return this.service.createTask(u.sub, d); }
  @Patch('tasks/:id') updateTask(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() d: UpdateTaskDto): Promise<ProjectTask> { return this.service.updateTask(u.sub, id, d); }
  @Delete('tasks/:id') deleteTask(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<ProjectTask> { return this.service.deleteTask(u.sub, id); }
}
