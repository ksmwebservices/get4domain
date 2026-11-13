import { Global, Module, Type } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityOtpSender } from '../v3-registrar/identity.service';
import { InboundEmailController, MeInboxController } from './api/inbox.controllers';
import { EmailPort, EmailTransport, GuardedEmailPort, ResendTransport } from './email.port';
import { ChannelIdentityOtpSender, NoPhoneCodeSender, PhoneCodeSender } from './identity-otp.sender';
import { InboxService } from './inbox.service';
import { InboxStore } from './inbox.store';
import { PrismaInboxStore } from './prisma-inbox.store';
import { MailSettingsService } from './settings/mail-settings';

export const MAIL_CONTROLLERS: Type<unknown>[] = [MeInboxController, InboundEmailController];

/** Lane 1 email, the enquiry inbox and the identity code sender (Block 4b). Global so the registrar can take the OTP sender and later modules can take EmailPort. PlansModule (entitlements) is global. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: MAIL_CONTROLLERS,
  providers: [
    MailSettingsService, ResendTransport, { provide: EmailTransport, useExisting: ResendTransport }, GuardedEmailPort, { provide: EmailPort, useExisting: GuardedEmailPort },
    { provide: InboxStore, useClass: PrismaInboxStore }, InboxService,
    { provide: PhoneCodeSender, useClass: NoPhoneCodeSender }, { provide: IdentityOtpSender, useClass: ChannelIdentityOtpSender },
  ],
  exports: [EmailPort, MailSettingsService, IdentityOtpSender, PhoneCodeSender],
})
export class V3MailModule {}
