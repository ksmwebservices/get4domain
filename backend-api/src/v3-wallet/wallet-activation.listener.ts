import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { V3WalletService } from './wallet.service';

/**
 * Opens the wallet the moment a Pro term is paid. The two events below are the prompt path; the data-derived check in V3WalletService.syncActivation is the safety net (it runs whenever a
 * vendor looks at the wallet or starts a top-up), so a missed or failed event can never leave a paying vendor without a wallet. Both paths end in the same idempotent change.
 */
@Injectable()
export class WalletActivationListener implements OnModuleInit {
  constructor(private readonly wallet: V3WalletService, @Optional() private readonly bus?: ActivityBus) {}

  onModuleInit(): void {
    this.bus?.on('plan.order.paid', async (e) => {
      await this.wallet.onEvidence(e.vendorId, { kind: 'PLAN_ORDER_PAID', planLevel: e.data?.planLevel === 'PRO' ? 'PRO' : 'FREE' }, `order:${String(e.data?.orderId ?? '')}`);
    });
    this.bus?.on('subscription.assigned', async (e) => {
      await this.wallet.onEvidence(e.vendorId, {
        kind: 'SUBSCRIPTION', level: e.data?.level === 'PRO' ? 'PRO' : 'FREE', source: String(e.data?.source ?? ''), reason: typeof e.data?.reason === 'string' ? e.data.reason : null,
      }, `subscription:${String(e.data?.subscriptionId ?? '')}`);
    });
  }
}
