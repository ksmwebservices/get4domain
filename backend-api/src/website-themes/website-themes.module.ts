import { Module } from '@nestjs/common';
import { WebsiteThemesController } from './website-themes.controller';
import { WebsiteThemesService } from './website-themes.service';

@Module({
  controllers: [WebsiteThemesController],
  providers: [WebsiteThemesService],
})
export class WebsiteThemesModule {}
