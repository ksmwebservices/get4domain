import { Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppShellService } from './app-shell.service';
import { AdminPackController, MePackController, PublicPackController } from './api/pack.controllers';
import { PublicPacksController } from './api/public-packs.controller';
import { NextStepFactsPort, NextStepsService, PrismaNextStepFacts } from './next-steps.service';
import { PackEngineService } from './pack-engine.service';
import { PackReferenceStore, PackVendorStore } from './pack-engine.store';
import { PrismaPackReferenceStore, PrismaPackVendorStore } from './prisma-pack-engine.store';
import { TabGuard } from './requires-tab';

export const PACK_PROVIDERS: Provider[] = [
  { provide: PackReferenceStore, useClass: PrismaPackReferenceStore }, { provide: PackVendorStore, useClass: PrismaPackVendorStore }, PackEngineService, AppShellService, TabGuard, NextStepsService, { provide: NextStepFactsPort, useClass: PrismaNextStepFacts },
];
export const PACK_CONTROLLERS: Type<unknown>[] = [PublicPackController, PublicPacksController, MePackController, AdminPackController];

/** The pack engine (Amendment 13 Part A). PlansModule (entitlements), the activity log and the tenant guard are global. Other modules import this one to use @RequiresTab. */
@Module({ imports: [PrismaModule], controllers: PACK_CONTROLLERS, providers: PACK_PROVIDERS, exports: [PackEngineService, TabGuard] })
export class V3PacksModule {}
