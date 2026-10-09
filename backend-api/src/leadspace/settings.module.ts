import { Module } from '@nestjs/common';
import { LeadspaceSettingsService } from './settings.service';

/** The LeadSpace admin settings, importable by the shared services (social publisher) without importing all of LeadSpace. */
@Module({ providers: [LeadspaceSettingsService], exports: [LeadspaceSettingsService] })
export class LeadspaceSettingsModule {}
