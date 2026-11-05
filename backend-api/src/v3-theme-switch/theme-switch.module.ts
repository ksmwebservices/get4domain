import { Injectable, Module, OnModuleInit, Optional, Provider, Type } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { OtpPepper } from '../directory/pepper';
import { PrismaModule } from '../prisma/prisma.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { V3ServicesModule } from '../v3-services/services.module';
import { AdminThemeSwitchController, MeThemeSwitchController } from './api/theme-switch.controllers';
import { PrismaThemeSwitchStore } from './prisma-theme-switch.store';
import { SitePipelinePort, SitePublishPipeline } from './site-pipeline.port';
import { ThemeSwitchService } from './theme-switch.service';
import { ThemeSwitchStore } from './theme-switch.store';

/** When Pro comes back (a plan order is paid, or a subscription a payment started), a theme that fell back during the lapse is restored. No charge; the service decides whether there is anything to restore. */
@Injectable()
export class ThemeRestoreListener implements OnModuleInit {
  constructor(private readonly themes: ThemeSwitchService, @Optional() private readonly bus?: ActivityBus) {}
  onModuleInit(): void {
    const run = async (vendorId: string): Promise<void> => { await this.themes.restoreIfNeeded(vendorId); };
    this.bus?.on('plan.order.paid', (e) => run(e.vendorId));
    this.bus?.on('subscription.assigned', (e) => run(e.vendorId));
  }
}

/** Every provider and controller of slice 5.16d in one list: the module and the staging test app use it. */
export const THEME_SWITCH_PROVIDERS: Provider[] = [{ provide: ThemeSwitchStore, useClass: PrismaThemeSwitchStore }, { provide: SitePipelinePort, useClass: SitePublishPipeline }, OtpPepper, ThemeSwitchService, ThemeRestoreListener];
export const THEME_SWITCH_CONTROLLERS: Type<unknown>[] = [MeThemeSwitchController, AdminThemeSwitchController];

/**
 * The Theme Switch Service (slice 5.16d). It applies a theme through the existing site slice (settings, build, publish) and spends through the wallet and services stores (global and imported). Nothing here
 * touches the legacy theme marketplace, billing, wallet or add-on code (decision D1).
 */
@Module({ imports: [PrismaModule, SitePublishModule, V3ServicesModule], controllers: THEME_SWITCH_CONTROLLERS, providers: THEME_SWITCH_PROVIDERS, exports: [ThemeSwitchService, ThemeSwitchStore] })
export class V3ThemeSwitchModule {}
