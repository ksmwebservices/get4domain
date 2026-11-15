import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageSettingsService } from '../v3-storage/settings/storage-settings';
import { S3PublicStorage } from '../v3-storage/s3.adapters';
import { FakeMediaStorage, ImagePort, MediaStoragePort, SharpImagePort } from '../v3-website/media/media.ports';
import { AdminMediaUploadController, MeMediaUploadController } from './api/media-upload.controllers';
import { MediaUploadService } from './media-upload.service';
import { MediaUploadStore } from './media-upload.store';
import { PrismaMediaUploadStore } from './prisma-media-upload.store';

/**
 * Picture storage: MEDIA_STORAGE_MODE=fake binds the in-memory fake (staging tests); otherwise the Cloudflare R2 adapter, selected only by environment and settings, which refuses with STORAGE_NOT_CONFIGURED until
 * its settings and keys exist, so real storage is OFF by default. The same rule the website library uses.
 */
const storageProvider = { provide: MediaStoragePort, useFactory: (settings: StorageSettingsService) => (process.env.MEDIA_STORAGE_MODE === 'fake' ? new FakeMediaStorage() : new S3PublicStorage(settings)), inject: [StorageSettingsService] };

/** Wave 2 Part D: uploads of pictures and pdf documents, for a vendor and for staff. The activity log and the storage settings are global. */
@Module({
  imports: [PrismaModule],
  controllers: [MeMediaUploadController, AdminMediaUploadController],
  providers: [{ provide: MediaUploadStore, useClass: PrismaMediaUploadStore }, storageProvider, { provide: ImagePort, useClass: SharpImagePort }, MediaUploadService],
  exports: [MediaUploadService],
})
export class V3MediaUploadModule {}
