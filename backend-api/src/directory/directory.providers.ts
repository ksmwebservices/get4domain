import { Provider, Type } from '@nestjs/common';
import { DirectoryAdminController } from './api/directory-admin.controller';
import { DirectoryPublicController } from './api/directory-public.controller';
import { MeDirectoryController } from './api/me-directory.controller';
import { DirectoryAudit, PrismaDirectoryAudit } from './directory-audit';
import { DirectoryAdminService } from './directory-admin.service';
import { DirectoryReadService } from './directory-read.service';
import { DirectoryRemovalService } from './directory-removal.service';
import { DirectoryRepository } from './directory.repository';
import { AccountSetupGrantService } from './grants/account-setup-grant.service';
import { MeDirectoryService } from './me-directory.service';
import { OtpPepper } from './pepper';
import { PrismaDirectoryRepository } from './prisma-directory.repository';
import { DirectoryVisitService } from './directory-visit.service';
import { DirectorySettingsService } from './settings/directory-settings.service';
import { ModeSmsAdapter, SmsAdapter } from './sms/sms-adapter';

/** Every provider and controller of the directory slice in one list: DirectoryModule uses it and the staging integration tests assemble the same list into a slim app. */
export const DIRECTORY_PROVIDERS: Provider[] = [
  { provide: DirectoryRepository, useClass: PrismaDirectoryRepository },
  { provide: DirectoryAudit, useClass: PrismaDirectoryAudit },
  { provide: SmsAdapter, useClass: ModeSmsAdapter },
  DirectorySettingsService, OtpPepper, DirectoryReadService, DirectoryAdminService, DirectoryRemovalService, MeDirectoryService, AccountSetupGrantService, DirectoryVisitService,
];
export const DIRECTORY_CONTROLLERS: Type<unknown>[] = [DirectoryPublicController, MeDirectoryController, DirectoryAdminController];
export const DIRECTORY_EXPORTS = [DirectoryRepository, DirectoryAudit, SmsAdapter, DirectorySettingsService, OtpPepper, DirectoryReadService, DirectoryAdminService, AccountSetupGrantService, DirectoryVisitService];
