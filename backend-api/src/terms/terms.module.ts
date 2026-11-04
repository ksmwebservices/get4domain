import { Global, Module, Provider, Type } from '@nestjs/common';
import { OtpPepper } from '../directory/pepper';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTermsController, MeTermsController, PublicTermsController } from './api/terms.controllers';
import { PrismaTermsStore } from './prisma-terms.store';
import { AcceptanceGuard, TermsSessionFlag } from './terms-ports';
import { TermsService } from './terms.service';
import { TermsStore } from './terms.store';

/** Every provider and controller of slice 5.15 in one list: the module and the HTTP unit tests use it. */
export const TERMS_PROVIDERS: Provider[] = [
  { provide: TermsStore, useClass: PrismaTermsStore }, OtpPepper, TermsService,
  { provide: AcceptanceGuard, useExisting: TermsService }, { provide: TermsSessionFlag, useExisting: TermsService },
];
export const TERMS_CONTROLLERS: Type<unknown>[] = [PublicTermsController, MeTermsController, AdminTermsController];

/**
 * Terms documents and acceptances (slice 5.15). GLOBAL, like the Batch 3 settings: the site publisher, the requests module, the claim step and the sign-in read the same guard without each
 * importing this module. PlansModule (audit) is global too. A build or a test without this module simply has no guard, which means no check.
 */
@Global()
@Module({ imports: [PrismaModule], controllers: TERMS_CONTROLLERS, providers: TERMS_PROVIDERS, exports: [TermsService, AcceptanceGuard, TermsSessionFlag] })
export class TermsModule {}
