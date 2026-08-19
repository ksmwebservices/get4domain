import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DesignService } from './design.service';
import { DesignTemplateDef } from './design.templates';

@ApiTags('design')
@Controller('design')
export class DesignController {
  constructor(private readonly service: DesignService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Built-in sample Fabric.js design templates (scene JSON + prefill fields)' })
  templates(): DesignTemplateDef[] {
    return this.service.templates();
  }
}
