import { Module } from '@nestjs/common';
import { LeadspaceSettingsModule } from '../leadspace/settings.module';
import { SocialAccountsService } from './social-accounts.service';
import { SocialAdminController } from './social.controllers';
import { SocialPublisherService } from './social-publisher.service';

/** The shared social publisher (Dispatch A section 6): accounts with encrypted tokens, scheduling, retries, a post log, daily caps. */
@Module({
  imports: [LeadspaceSettingsModule],
  controllers: [SocialAdminController],
  providers: [SocialAccountsService, SocialPublisherService],
  exports: [SocialAccountsService, SocialPublisherService],
})
export class SocialModule {}
