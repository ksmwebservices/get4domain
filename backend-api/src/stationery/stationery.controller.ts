import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StationeryItem } from '@prisma/client';
import { StationeryService } from './stationery.service';
import { CreateStationeryDto, UpdateStationeryDto } from './dto/stationery.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('stationery')
@ApiBearerAuth()
@Controller('stationery')
export class StationeryController {
  constructor(private readonly service: StationeryService) {}
  @Get() @ApiOperation({ summary: "List the caller's stationery items" })
  list(@CurrentUser() u: AuthenticatedUser): Promise<StationeryItem[]> { return this.service.list(u.sub); }
  @Post() @ApiOperation({ summary: 'Add a stationery item' })
  create(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreateStationeryDto): Promise<StationeryItem> { return this.service.create(u.sub, dto); }
  @Put(':id') @ApiOperation({ summary: 'Update quantity/threshold' })
  update(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateStationeryDto): Promise<StationeryItem> { return this.service.update(u.sub, id, dto); }
  @Delete(':id') @ApiOperation({ summary: 'Delete an item' })
  remove(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string): Promise<StationeryItem> { return this.service.remove(u.sub, id); }
}
