import { Provider, Type } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { LifecycleAdminController } from './api/lifecycle-admin.controller';
import { MeAccountController } from './api/me-account.controller';
import { LifecycleStore } from './lifecycle.store';
import { PrismaLifecycleStore } from './prisma-lifecycle.store';
import { VendorLifecycleService } from './vendor-lifecycle.service';

export const VENDOR_LIFECYCLE_PROVIDERS: Provider[] = [{ provide: LifecycleStore, useClass: PrismaLifecycleStore }, VendorLifecycleService, AccountDeletionService];
export const VENDOR_LIFECYCLE_CONTROLLERS: Type<unknown>[] = [MeAccountController, LifecycleAdminController];
