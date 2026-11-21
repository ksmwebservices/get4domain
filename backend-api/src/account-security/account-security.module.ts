import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { AccountDirectory } from './account-directory.service';
import { AccountSecurityController } from './account-security.controller';
import { LoginHandoffController } from './login-handoff.controller';
import { LoginHandoffService } from './login-handoff.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisioningSettingsService } from '../provisioning/settings/provisioning-settings.service';
import { PasswordService } from './password.service';
import { PublicPasswordResetController } from './public-password-reset.controller';
import { PublicPasswordResetService, RESET_PUBLIC_URL } from './public-password-reset.service';
import { SessionService } from './session.service';

/** Everything the controller needs apart from AuthService / EmailService / JwtService (the integration tests mount exactly this list). */
export const ACCOUNT_SECURITY_PROVIDERS = [AccountDirectory, SessionService, PasswordService, LoginHandoffService, PublicPasswordResetService];

/** G14: the public site's address for the reset link, from the same setting the claim links use. */
const RESET_URL_PROVIDER = { provide: RESET_PUBLIC_URL, useFactory: (prisma: PrismaService) => async (): Promise<string> => (await new ProvisioningSettingsService(prisma).get()).publicAppUrl, inject: [PrismaService] };

/** S13: password reset / change and rotating refresh tokens. Additive: it does not change AuthModule, AuthService or the existing /auth routes. */
@Module({
  imports: [AuthModule, EmailModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [AccountSecurityController, LoginHandoffController, PublicPasswordResetController],
  providers: [...ACCOUNT_SECURITY_PROVIDERS, RESET_URL_PROVIDER],
  exports: [SessionService],
})
export class AccountSecurityModule {}
