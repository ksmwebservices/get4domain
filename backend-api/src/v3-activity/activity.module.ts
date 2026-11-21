import { Global, Module, Provider, Type } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OtpPepper } from '../directory/pepper';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityBusListener } from './activity-bus.listener';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService, AlertsService } from './activity.service';
import { ActivityStore } from './activity.store';
import { AdminAlertsController, MeActivityController } from './api/activity.controllers';
import { PrismaActivityStore } from './prisma-activity.store';

/** Every provider and controller of slice 5.20 in one list: the module and the staging test app use it. */
export const ACTIVITY_PROVIDERS: Provider[] = [{ provide: ActivityStore, useClass: PrismaActivityStore }, OtpPepper, ActivityService, AlertsService, ActivityBusListener, { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor }];
export const ACTIVITY_CONTROLLERS: Type<unknown>[] = [MeActivityController, AdminAlertsController];

/**
 * The activity log and the alerts (slice 5.20). Global, so every V3 module can inject `ActivityService` and call `record()` without importing this module. Nothing here touches the legacy audit,
 * notification, billing, wallet or add-on code (decision D1); the legacy `g4d_notifications` table is not used (the in-app notices live in `g4d_v3_notifications`).
 */
@Global()
@Module({ imports: [PrismaModule], controllers: ACTIVITY_CONTROLLERS, providers: ACTIVITY_PROVIDERS, exports: [ActivityService, ActivityStore] })
export class V3ActivityModule {}
