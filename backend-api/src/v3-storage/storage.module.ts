import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImagePort, SharpImagePort } from '../v3-website/media/media.ports';
import { PrivateFilesService } from './private-files.service';
import { PrismaStorageAccessStore } from './prisma-storage.store';
import { S3PrivateStorage } from './s3.adapters';
import { StorageSettingsService } from './settings/storage-settings';
import { ContentScanPort, NoScanner, PrivateObjectStore, StorageAccessStore } from './storage.ports';

/**
 * Storage (Block 4b, Amendment 12 Q2): the settings, the private object store, its access log and the private file service. The PUBLIC store is bound inside the Website module
 * (S3PublicStorage replaces the old "unconfigured" binding there). Global so any module that holds identity documents or proofs can inject PrivateFilesService.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    StorageSettingsService, S3PrivateStorage, { provide: PrivateObjectStore, useExisting: S3PrivateStorage }, { provide: StorageAccessStore, useClass: PrismaStorageAccessStore },
    { provide: ContentScanPort, useClass: NoScanner }, { provide: ImagePort, useClass: SharpImagePort }, PrivateFilesService,
  ],
  exports: [StorageSettingsService, PrivateFilesService, PrivateObjectStore],
})
export class V3StorageModule {}
