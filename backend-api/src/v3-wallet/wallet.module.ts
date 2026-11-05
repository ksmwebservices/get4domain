import { Global, Module, Provider, Type } from '@nestjs/common';
import { PlanBillingModule } from '../plan-billing/plan-billing.module';
import { TopupSettlementHook } from '../plan-billing/topup-hook';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminWalletController, MeWalletController } from './api/wallet.controllers';
import { PrismaWalletStore, PrismaWalletTxProvider } from './prisma-wallet.store';
import { WalletSettingsService } from './settings/wallet-settings.service';
import { WalletActivationListener } from './wallet-activation.listener';
import { WalletCron } from './wallet.cron';
import { V3WalletService } from './wallet.service';
import { WalletStore, WalletTxProvider } from './wallet.store';

/** Every provider and controller of the wallet slices in one list: the module and the HTTP unit tests use it. The services slices (packs, requests, theme switch) have their own modules and spend through WalletStore. */
export const WALLET_PROVIDERS: Provider[] = [
  { provide: WalletStore, useClass: PrismaWalletStore }, { provide: WalletTxProvider, useClass: PrismaWalletTxProvider },
  WalletSettingsService, V3WalletService, { provide: TopupSettlementHook, useExisting: V3WalletService }, WalletActivationListener, WalletCron,
];
export const WALLET_CONTROLLERS: Type<unknown>[] = [MeWalletController, AdminWalletController];

/**
 * The V3 wallet (slices 5.16a and 5.16a-2). GLOBAL, like the terms module: plan billing asks it (optionally) about top-up payments and for a place in its transaction, and the services
 * built on it (packs, requests, theme switch) spend through the same store. PlansModule (audit, entitlements) is global too. Without this module plan payments behave exactly as before.
 * Nothing here touches the legacy wallet (src/wallet): own tables, own ledger (decision D1).
 */
@Global()
@Module({
  imports: [PrismaModule, PlanBillingModule],
  controllers: WALLET_CONTROLLERS,
  providers: WALLET_PROVIDERS,
  exports: [V3WalletService, WalletStore, WalletTxProvider, TopupSettlementHook, WalletSettingsService],
})
export class V3WalletModule {}
