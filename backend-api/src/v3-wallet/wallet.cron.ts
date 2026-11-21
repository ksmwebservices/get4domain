import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletSettingsService } from './settings/wallet-settings.service';
import { V3WalletService } from './wallet.service';

/** The hourly tick: credit past its date is written off and stale top-up orders stop being payable. OFF by default (walletExpiryTickEnabled); staff can run the same work by hand. One tick at a time per process. */
@Injectable()
export class WalletCron {
  private readonly logger = new Logger(WalletCron.name);
  private busy = false;
  constructor(private readonly wallet: V3WalletService, private readonly settings: WalletSettingsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!(await this.settings.get()).walletExpiryTickEnabled) return;
      const r = await this.wallet.runExpiry();
      if (r.entries || r.failed) this.logger.log(`wallet expiry: ${r.entries} written off, ${r.failed} failed, ${r.topupsExpired} stale top-ups closed`);
    } catch (e) {
      this.logger.error(`wallet tick failed: ${e instanceof Error ? e.name : 'error'}`);   // the message can echo a connection string; the name cannot
    } finally { this.busy = false; }
  }
}
