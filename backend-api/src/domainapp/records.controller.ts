import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecordsService } from './records.service';
import { CreateRecordDto, UpdateRecordDto, UpdateRecordStatusDto } from './dto/record.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('domainapp-records')
@ApiBearerAuth()
@Controller('domainapp/records')
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Get()
  @ApiOperation({ summary: 'List records for the current vendor (?status=&search=&page=&limit=)' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListQueryDto) {
    return this.recordsService.findAll(user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a record' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecordDto) {
    return this.recordsService.create(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single record (with contact, catalog item, invoice)' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recordsService.findOne(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a record' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRecordDto) {
    return this.recordsService.update(user.sub, id, dto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update only the status of a record' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecordStatusDto,
  ) {
    return this.recordsService.updateStatus(user.sub, id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a record' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.recordsService.remove(user.sub, id);
  }
}
