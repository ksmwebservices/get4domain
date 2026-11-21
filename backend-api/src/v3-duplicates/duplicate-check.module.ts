import { Global, Module, Provider, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DuplicateAdminController } from './api/duplicate-admin.controller';
import { DuplicateCheckService } from './duplicate-check.service';
import { DuplicateHoldPort, DuplicateStore } from './duplicate.store';
import { PrismaDuplicateStore } from './prisma-duplicate.store';

/** Every provider of the duplicate check, in one list (the staging test app assembles the same list the way it does for the other V3 modules). */
export const DUPLICATE_PROVIDERS: Provider[] = [
  { provide: DuplicateStore, useClass: PrismaDuplicateStore }, DuplicateCheckService, { provide: DuplicateHoldPort, useExisting: DuplicateCheckService },
];
export const DUPLICATE_CONTROLLERS: Type<unknown>[] = [DuplicateAdminController];

/**
 * D1: the ONE duplicate check (docs/v3/DISPATCH_REPORT_B1.md). Global, so every creation path (registration, admin vendor, provisioning, seeded sites, deals, starter sites) and the publish step
 * receive the same instance without importing each other.
 */
@Global()
@Module({ imports: [PrismaModule], controllers: DUPLICATE_CONTROLLERS, providers: DUPLICATE_PROVIDERS, exports: [DuplicateCheckService, DuplicateHoldPort] })
export class DuplicateCheckModule {}
