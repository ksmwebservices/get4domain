import { Module } from '@nestjs/common';
import { SeededSitesModule } from '../seeded-sites/seeded-sites.module';
import { V3ProfileFieldsModule } from '../v3-profile-fields/profile.module';
import { ListingImportController } from './api/listing-import.controller';
import { ListingImportService } from './listing-import.service';

/** Wave 2 Part D: the listing import. It reuses the seeded-site rules and creation, and the profile fields; the activity log is global. */
@Module({ imports: [SeededSitesModule, V3ProfileFieldsModule], controllers: [ListingImportController], providers: [ListingImportService], exports: [ListingImportService] })
export class V3ListingImportModule {}
