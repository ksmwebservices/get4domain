import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
