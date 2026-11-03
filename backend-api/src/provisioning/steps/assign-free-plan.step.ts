import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from '../../plans/subscriptions/subscriptions.service';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { parseBusinessInput } from './business-input';

/**
 * Step 2. Gives the vendor the Free plan of the business's track, through the slice 5.1 function (idempotent: an existing subscription is returned).
 * Source is STAFF and this runs whatever the registrationProvisioning setting says: that setting governs self-registration only.
 */
@Injectable()
export class AssignFreePlanStep implements ProvisioningStep {
  readonly key = 'ASSIGN_FREE_PLAN' as const;
  constructor(private readonly subscriptions: Pick<SubscriptionsService, 'provisionFreeSubscription'>) {}

  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.vendorId) throw new StepError('UNKNOWN_VENDOR', false);
    const { track } = parseBusinessInput(ctx.input);
    try {
      const sub = await this.subscriptions.provisionFreeSubscription(ctx.vendorId, track, 'STAFF');
      return { outputRef: { subscriptionId: sub.id } };
    } catch (e) {
      if (e instanceof BadRequestException) throw new StepError(/track/i.test(e.message) ? 'UNKNOWN_TRACK' : 'UNKNOWN_PLAN', false);   // a retired or unusable plan is also permanent
      if (e instanceof NotFoundException) {
        const body = e.getResponse() as { code?: string };
        throw new StepError(body?.code === 'UNKNOWN_VENDOR' ? 'UNKNOWN_VENDOR' : 'UNKNOWN_PLAN', false);
      }
      throw e;
    }
  }
}
