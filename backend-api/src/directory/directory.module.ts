import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DIRECTORY_CONTROLLERS, DIRECTORY_EXPORTS, DIRECTORY_PROVIDERS } from './directory.providers';

/**
 * The public directory (slice 5.7): place and category trees, businesses with full-text and trigram search, labelled sponsored placements, removal requests, the vendor's own profile, and
 * the OTP / grant building blocks the claim flow uses. PlansModule is @Global, so the audit service is available here. The claim OTP service and the optional provisioning step live in
 * the provisioning module (they depend on the claim link and the job runner); this module depends on neither.
 */
@Module({
  imports: [PrismaModule],
  controllers: DIRECTORY_CONTROLLERS,
  providers: DIRECTORY_PROVIDERS,
  exports: DIRECTORY_EXPORTS,
})
export class DirectoryModule {}
