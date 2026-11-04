import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AI_STUDIO_CONTROLLERS, AI_STUDIO_PROVIDERS } from './ai-studio.providers';
import { AiGenerateService } from './ai-generate.service';

/**
 * AI Studio providers and credits (slice 5.11). PlansModule is @Global, so the entitlement engine and the audit service are available here. This module is separate from the legacy `ai`
 * module and does not use it. NO real model is called unless the plan setting aiLiveCalls is true AND a provider row is ACTIVE with a secret that decrypts.
 */
@Module({ imports: [PrismaModule], controllers: AI_STUDIO_CONTROLLERS, providers: AI_STUDIO_PROVIDERS, exports: [AiGenerateService] })
export class AiStudioModule {}
