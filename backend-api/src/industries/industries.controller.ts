import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IndustriesService } from './industries.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('industries')
@Controller('industries')
export class IndustriesController {
  constructor(private readonly industriesService: IndustriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List industry configs (full, or ?summary=true for key/label/icon only)' })
  findAll(@Query('summary') summary?: string) {
    if (summary === 'true') {
      return this.industriesService.findAllSummary();
    }
    return this.industriesService.findAll();
  }

  @Public()
  @Get(':key')
  @ApiOperation({ summary: 'Get a single industry config (drives per-vendor dashboard rendering)' })
  findOne(@Param('key') key: string) {
    return this.industriesService.findOne(key);
  }
}
