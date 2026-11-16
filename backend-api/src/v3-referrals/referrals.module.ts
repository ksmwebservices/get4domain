import { Global, Module, Provider, Type } from '@nestjs/common';
import { PlanPaidHook } from '../plan-billing/plan-paid.hook';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralAttributionPort } from '../plans/registration/referral-attribution.port';
import { V3PartnersModule } from '../v3-partners/partners.module';
import { AdminReferralsController, PartnerReferralsController, PublicReferralController } from './api/referrals.controllers';
import { PrismaReferralsStore } from './prisma-referrals.store';
import { ReferralsService } from './referrals.service';
import { ReferralsStore } from './referrals.store';

/**
 * Referrals and commission (Wave 3 Part I). Global, so the settlement (billing) and the registration path (auth) can take the plan-paid hook and the attribution port as OPTIONAL dependencies without importing
 * this module; a build or a test without it behaves exactly as before. The activity log is global too.
 */
export const REFERRALS_PROVIDERS: Provider[] = [{ provide: ReferralsStore, useClass: PrismaReferralsStore }, ReferralsService, { provide: PlanPaidHook, useExisting: ReferralsService }, { provide: ReferralAttributionPort, useExisting: ReferralsService }];
export const REFERRALS_CONTROLLERS: Type<unknown>[] = [AdminReferralsController, PartnerReferralsController, PublicReferralController];

@Global()
@Module({
  imports: [PrismaModule, V3PartnersModule],
  controllers: REFERRALS_CONTROLLERS,
  providers: REFERRALS_PROVIDERS,
  exports: [ReferralsService, PlanPaidHook, ReferralAttributionPort],
})
export class V3ReferralsModule {}
