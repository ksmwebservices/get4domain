import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsiteModule } from '../v3-website/website.module';
import { ContentPackController } from './content-pack.controller';
import { ContentPackService } from './content-pack.service';

/** Content pack import for staff (E5). It writes only through the Website manager (WebsiteService) and the vendor's own items. */
@Module({ imports: [PrismaModule, WebsiteModule], controllers: [ContentPackController], providers: [ContentPackService] })
export class ContentPackModule {}
