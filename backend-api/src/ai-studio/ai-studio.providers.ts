import { Provider, Type } from '@nestjs/common';
import { AiAdminController } from './api/ai-admin.controller';
import { MeAiController } from './api/me-ai.controller';
import { AiAdminService } from './ai-admin.service';
import { AiGenerateService } from './ai-generate.service';
import { AiStudioRepository } from './ai-studio.repository';
import { PrismaAiStudioRepository } from './prisma-ai-studio.repository';
import { AiProviderGate } from './providers/ai-provider-gate';
import { AiSettingsService } from './settings/ai-settings.service';

/** Every provider and controller of AI Studio in one list: AiStudioModule uses it and the staging integration tests assemble the same list into a slim app. */
export const AI_STUDIO_PROVIDERS: Provider[] = [{ provide: AiStudioRepository, useClass: PrismaAiStudioRepository }, AiSettingsService, AiProviderGate, AiGenerateService, AiAdminService];
export const AI_STUDIO_CONTROLLERS: Type<unknown>[] = [MeAiController, AiAdminController];
