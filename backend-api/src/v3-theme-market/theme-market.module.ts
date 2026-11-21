import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminThemeMarketController } from './api/theme-market.controllers';
import { MeThemeMarketController, PublicThemeMarketController } from './api/theme-marketplace.controllers';
import { PrismaThemeMarketStore } from './prisma-theme-market.store';
import { ThemeChangeNotifier, ThemeMarketService } from './theme-market.service';
import { ThemeMarketStore } from './theme-market.store';
import { ThemeMarketplaceService } from './theme-marketplace.service';
import { ThemePreviewService } from './theme-preview.service';

export const THEME_MARKET_PROVIDERS: Provider[] = [{ provide: ThemeMarketStore, useClass: PrismaThemeMarketStore }, ThemeChangeNotifier, ThemePreviewService, ThemeMarketService, ThemeMarketplaceService];
export const THEME_MARKET_CONTROLLERS: Type<unknown>[] = [AdminThemeMarketController, PublicThemeMarketController, MeThemeMarketController];

/**
 * The theme marketplace (TM1). The audit service comes from the global plans module; the theme kit is loaded by the services themselves, so this module imports nothing of the site pipeline. The vendor-facing
 * listing finds the renderer, the site settings and the theme catalogue through ModuleRef (as the theme catalogue does), so no import cycle exists.
 */
@Module({ imports: [PrismaModule], controllers: THEME_MARKET_CONTROLLERS, providers: THEME_MARKET_PROVIDERS, exports: [ThemeMarketService, ThemeChangeNotifier, ThemeMarketStore] })
export class V3ThemeMarketModule {}
