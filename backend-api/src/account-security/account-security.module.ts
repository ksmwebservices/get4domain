import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { AccountDirectory } from './account-directory.service';
import { AccountSecurityController } from './account-security.controller';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

/** Everything the controller needs apart from AuthService / EmailService / JwtService (the integration tests mount exactly this list). */
export const ACCOUNT_SECURITY_PROVIDERS = [AccountDirectory, SessionService, PasswordService];

/** S13: password reset / change and rotating refresh tokens. Additive: it does not change AuthModule, AuthService or the existing /auth routes. */
@Module({
  imports: [AuthModule, EmailModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [AccountSecurityController],
  providers: ACCOUNT_SECURITY_PROVIDERS,
  exports: [SessionService],
})
export class AccountSecurityModule {}
