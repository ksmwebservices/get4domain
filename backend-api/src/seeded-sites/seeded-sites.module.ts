import { Module, Provider, Type } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { VendorLifecycleModule } from '../vendor-lifecycle/vendor-lifecycle.module';
import { SeededAdminController } from './api/seeded-admin.controller';
import { ClaimsHandover, DirectorySeededFacts, JobSeedProvisioner, ModuleSeededPublisher } from './seeded-adapters';
import { ClaimHandover, SeedProvisioner, SeededFacts, SeededPublisher } from './seeded-ports';
import { SeededSettingsService } from './seeded-settings.service';
import { SeededSitesService } from './seeded-sites.service';
import { PrismaSeededStore } from './prisma-seeded.store';
import { SeededStore } from './seeded.store';

export const SEEDED_PROVIDERS: Provider[] = [
  { provide: SeededStore, useClass: PrismaSeededStore }, { provide: SeedProvisioner, useClass: JobSeedProvisioner }, { provide: SeededPublisher, useClass: ModuleSeededPublisher },
  { provide: ClaimHandover, useClass: ClaimsHandover }, { provide: SeededFacts, useClass: DirectorySeededFacts }, SeededSitesService, SeededSettingsService,
];
export const SEEDED_CONTROLLERS: Type<unknown>[] = [SeededAdminController];

/** Seeded sites (slice 5.13a). Provisioning, directory, site publish and the lifecycle module are imported; PlansModule and B3SettingsModule are global. */
@Module({
  imports: [PrismaModule, DirectoryModule, ProvisioningModule, SitePublishModule, VendorLifecycleModule],
  controllers: SEEDED_CONTROLLERS,
  providers: SEEDED_PROVIDERS,
  exports: [SeededSitesService],
})
export class SeededSitesModule {}
