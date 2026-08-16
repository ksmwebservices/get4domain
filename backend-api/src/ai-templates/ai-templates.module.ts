import { Module } from '@nestjs/common';
import { AiTemplatesController } from './ai-templates.controller';
import { AiTemplatesService } from './ai-templates.service';

@Module({
  controllers: [AiTemplatesController],
  providers: [AiTemplatesService],
})
export class AiTemplatesModule {}
