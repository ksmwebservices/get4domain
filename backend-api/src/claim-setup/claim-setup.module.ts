import { Module, Provider, Type } from '@nestjs/common';
import { DirectoryModule } from '../directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SitePublishModule } from '../site-publish/site-publish.module';
import { TermsModule } from '../terms/terms.module';
import { ClaimAccountStore, PrismaClaimAccountStore } from './claim-account.store';
import { ClaimSetupController, MeClaimController } from './claim-setup.controller';
import { ClaimSetupService } from './claim-setup.service';
import { RealSiteGoLive, SiteGoLivePort } from './site-go-live.port';

export const CLAIM_SETUP_PROVIDERS: Provider[] = [{ provide: ClaimAccountStore, useClass: PrismaClaimAccountStore }, { provide: SiteGoLivePort, useClass: RealSiteGoLive }, ClaimSetupService];
export const CLAIM_SETUP_CONTROLLERS: Type<unknown>[] = [ClaimSetupController, MeClaimController];

/**
 * After the claim code (Amendment 13 B3 and B7): redeem the account-setup grant (accept the Terms, choose a password) and approve the site so it goes live on its subdomain. Its own module so the
 * provisioning and directory code never write to a vendor's login (decision D1): the one write is in ClaimAccountStore.
 */
@Module({ imports: [PrismaModule, DirectoryModule, SitePublishModule, TermsModule], controllers: CLAIM_SETUP_CONTROLLERS, providers: CLAIM_SETUP_PROVIDERS })
export class ClaimSetupModule {}
