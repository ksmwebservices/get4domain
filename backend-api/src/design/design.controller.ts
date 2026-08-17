import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DesignService } from './design.service';
import { DesignTemplateDef } from './design.templates';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('design')
@Controller('design')
export class DesignController {
  constructor(private readonly service: DesignService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Publishable Polotno key + whether the design editor is configured' })
  config(): Promise<{ polotnoKey: string | null; hasKey: boolean }> {
    return this.service.config();
  }

  @Get('templates')
  @ApiOperation({ summary: 'Built-in sample Polotno design templates (scene JSON + prefill fields)' })
  templates(): DesignTemplateDef[] {
    return this.service.templates();
  }
}
