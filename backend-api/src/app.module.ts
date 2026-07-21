import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VendorsModule } from './vendors/vendors.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { CmsModule } from './cms/cms.module';
import { EmailModule } from './email/email.module';
import { SupportModule } from './support/support.module';
import { AiModule } from './ai/ai.module';
import { LeadsModule } from './leads/leads.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CampaignPagesModule } from './campaign-pages/campaign-pages.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { CrmModule } from './crm/crm.module';
import { TeamModule } from './team/team.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    VendorsModule,
    SubscriptionsModule,
    InvoicesModule,
    PaymentsModule,
    CmsModule,
    EmailModule,
    SupportModule,
    AiModule,
    LeadsModule,
    WalletModule,
    NotificationsModule,
    CampaignPagesModule,
    CampaignsModule,
    CrmModule,
    TeamModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
