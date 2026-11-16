import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MeThemesController, PublicThemesController } from './api/theme-catalog.controllers';
import { ThemeCatalogV3Service } from './theme-catalog.service';

/** The theme catalogue per pack (Wave 3 Part H). Read only. The site, theme-render and theme-switch services are found through ModuleRef, so no module is imported and no cycle exists. */
@Module({ imports: [PrismaModule], controllers: [PublicThemesController, MeThemesController], providers: [ThemeCatalogV3Service] })
export class V3ThemeCatalogModule {}
