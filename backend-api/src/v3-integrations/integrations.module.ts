import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationSettingsService } from './integration-settings.service';
import { IntegrationProbe, LiveIntegrationProbe } from './integration-probe';
import { IntegrationsController } from './integrations.controller';

/** R1.1: the platform integration settings. The activity log (the audit) comes from the global V3ActivityModule. Exported so the registrar can read its saved keys. */
@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController],
  providers: [IntegrationSettingsService, { provide: IntegrationProbe, useClass: LiveIntegrationProbe }],
  exports: [IntegrationSettingsService],
})
export class V3IntegrationsModule {}
