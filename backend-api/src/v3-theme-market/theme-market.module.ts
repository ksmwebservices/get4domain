import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminThemeMarketController } from './api/theme-market.controllers';
import { PrismaThemeMarketStore } from './prisma-theme-market.store';
import { ThemeChangeNotifier, ThemeMarketService } from './theme-market.service';
import { ThemeMarketStore } from './theme-market.store';

export const THEME_MARKET_PROVIDERS: Provider[] = [{ provide: ThemeMarketStore, useClass: PrismaThemeMarketStore }, ThemeChangeNotifier, ThemeMarketService];
export const THEME_MARKET_CONTROLLERS: Type<unknown>[] = [AdminThemeMarketController];

/** The theme marketplace (TM1). The audit service comes from the global plans module; the theme kit is loaded by the service itself, so this module imports nothing of the site pipeline. */
@Module({ imports: [PrismaModule], controllers: THEME_MARKET_CONTROLLERS, providers: THEME_MARKET_PROVIDERS, exports: [ThemeMarketService, ThemeChangeNotifier, ThemeMarketStore] })
export class V3ThemeMarketModule {}
