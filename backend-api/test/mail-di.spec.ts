import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { ActivityBus } from '../src/common/activity-bus';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { EmailPort, GuardedEmailPort } from '../src/v3-mail/email.port';
import { ChannelIdentityOtpSender, NoPhoneCodeSender, PhoneCodeSender } from '../src/v3-mail/identity-otp.sender';
import { InboxService } from '../src/v3-mail/inbox.service';
import { InboxStore } from '../src/v3-mail/inbox.store';
import { PrismaInboxStore } from '../src/v3-mail/prisma-inbox.store';
import { EmailTransport, ResendTransport } from '../src/v3-mail/email.port';
import { MailSettingsService } from '../src/v3-mail/settings/mail-settings';
import { IdentityOtpSender } from '../src/v3-registrar/identity.service';
import { PrivateFilesService } from '../src/v3-storage/private-files.service';
import { PrismaStorageAccessStore } from '../src/v3-storage/prisma-storage.store';
import { S3PrivateStorage, S3PublicStorage } from '../src/v3-storage/s3.adapters';
import { StorageSettingsService } from '../src/v3-storage/settings/storage-settings';
import { ContentScanPort, NoScanner, PrivateObjectStore, StorageAccessStore } from '../src/v3-storage/storage.ports';
import { ImagePort, SharpImagePort } from '../src/v3-website/media/media.ports';

/**
 * A real Nest dependency resolution of the Block 4b providers, with only PrismaService, the entitlements and the bus stubbed. A constructor parameter Nest cannot resolve (for example a default
 * function parameter without @Optional()) fails here instead of at boot.
 */
describe('dependency injection of the Block 4b providers', () => {
  const external = [PrismaService, EntitlementsService, ActivityBus].map((provide) => ({ provide, useValue: {} }));
  it('storage resolves', async () => {
    const m = await Test.createTestingModule({ providers: [...external, StorageSettingsService, S3PrivateStorage, S3PublicStorage, { provide: PrivateObjectStore, useExisting: S3PrivateStorage }, { provide: StorageAccessStore, useClass: PrismaStorageAccessStore }, { provide: ContentScanPort, useClass: NoScanner }, { provide: ImagePort, useClass: SharpImagePort }, PrivateFilesService] }).compile();
    expect(m.get(PrivateFilesService)).toBeInstanceOf(PrivateFilesService);
  });
  it('mail and the inbox resolve, and the identity sender is the channel sender', async () => {
    const m = await Test.createTestingModule({ providers: [...external, MailSettingsService, ResendTransport, { provide: EmailTransport, useExisting: ResendTransport }, GuardedEmailPort, { provide: EmailPort, useExisting: GuardedEmailPort }, { provide: InboxStore, useClass: PrismaInboxStore }, InboxService, { provide: PhoneCodeSender, useClass: NoPhoneCodeSender }, { provide: IdentityOtpSender, useClass: ChannelIdentityOtpSender }] }).compile();
    expect(m.get(InboxService)).toBeInstanceOf(InboxService); expect(m.get(IdentityOtpSender)).toBeInstanceOf(ChannelIdentityOtpSender);
  });
});
