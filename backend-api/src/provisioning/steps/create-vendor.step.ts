import { Inject, Injectable, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { BusinessVendors, UniqueViolation } from '../vendors/business-vendors';
import { parseBusinessInput, slugifySubdomain } from './business-input';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** A random password nobody knows. The owner sets a real one when they claim the business. */
const randomPasswordHash = (): Promise<string> => bcrypt.hash(randomBytes(24).toString('hex'), 10);

/**
 * Step 1. Creates the (unclaimed) vendor for a staff-created business. Idempotent: a job that already has its vendor returns it. A business whose email or
 * phone already belongs to a vendor is refused permanently (DUPLICATE_BUSINESS); the existing vendor id goes in the step's outputRef, which only staff read.
 */
@Injectable()
export class CreateVendorStep implements ProvisioningStep {
  readonly key = 'CREATE_VENDOR' as const;
  constructor(private readonly vendors: BusinessVendors, @Optional() @Inject(PASSWORD_HASHER) private readonly hashPassword: () => Promise<string> = randomPasswordHash) {}

  async run(ctx: StepContext): Promise<StepResult> {
    if (ctx.job.vendorId) {
      if (!(await this.vendors.exists(ctx.job.vendorId))) throw new StepError('UNKNOWN_VENDOR', false);
      return { vendorId: ctx.job.vendorId, outputRef: { vendorId: ctx.job.vendorId } };
    }
    const biz = parseBusinessInput(ctx.input);
    const dup = await this.vendors.findDuplicate(biz.email, biz.phoneKey);
    if (dup) throw new StepError('DUPLICATE_BUSINESS', false, { existingVendorId: dup.id, matchedOn: dup.matched });

    const password = await this.hashPassword();
    const base = slugifySubdomain(biz.businessName);
    for (let n = 1; n <= 30; n++) {
      const subdomain = n === 1 ? base : `${base.slice(0, 36)}-${n}`;
      if (await this.vendors.subdomainTaken(subdomain)) continue;
      try {
        const v = await this.vendors.createForJob(ctx.job.id, {
          name: biz.ownerName, email: biz.email, password, businessName: biz.businessName, phone: biz.phone, industry: biz.category, subdomain,
          status: 'PENDING', source: ctx.job.createdByType === 'STAFF' ? 'STAFF' : 'SYSTEM', registeredByStaffId: ctx.job.createdByType === 'STAFF' ? ctx.job.createdById : null,
        });
        return { vendorId: v.id, outputRef: { vendorId: v.id } };
      } catch (e) {
        if (e instanceof UniqueViolation) {
          if (e.field === 'subdomain') continue;   // lost a race for this address: try the next one
          throw new StepError('DUPLICATE_BUSINESS', false);   // lost a race on the email
        }
        throw e;
      }
    }
    throw new StepError('UNEXPECTED', true);   // thirty addresses taken: extremely unlikely; retry later
  }
}
