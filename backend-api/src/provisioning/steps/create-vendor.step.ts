import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { BusinessVendors, UniqueViolation } from '../vendors/business-vendors';
import { DuplicateCheckService, Decision } from '../../v3-duplicates/duplicate-check.service';
import { parseBusinessInput, slugifySubdomain, BusinessInput } from './business-input';

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
  /** `dup` is the D1 duplicate check. It is always provided by the application (the module is global); it is optional in the constructor only so the older unit tests that build this step by hand keep their own fake check. */
  constructor(private readonly vendors: BusinessVendors, @Optional() @Inject(PASSWORD_HASHER) private readonly hashPassword: () => Promise<string> = randomPasswordHash, @Optional() private readonly dup?: DuplicateCheckService) {}

  /** The shared duplicate check for a staff-made business. A staff override travels in the job input (written by the admin service only after the role and the reason were checked, and checked again here). */
  private async guard(biz: BusinessInput, ctx: StepContext): Promise<Decision | null> {
    if (!this.dup) return null;
    const ov = (ctx.input as { duplicateOverride?: { reason?: unknown; staffId?: unknown; staffRole?: unknown } } | null)?.duplicateOverride;
    const actor = ov && typeof ov.staffId === 'string' && typeof ov.staffRole === 'string' ? { id: ov.staffId, role: ov.staffRole } : null;
    try {
      return await this.dup.enforce(
        // a SEEDED business carries a placeholder login nobody can use, so its e-mail says nothing about who it is
        { email: biz.seeded ? null : biz.email, phone: biz.phone, businessName: biz.businessName, city: biz.city, area: biz.area, pincode: biz.pincode, category: biz.category, ownerName: biz.seeded ? null : biz.ownerName, address: biz.addressLine },
        { path: biz.seeded ? 'SEEDED' : 'PROVISIONING', actor, overrideReason: typeof ov?.reason === 'string' ? ov.reason : null, selfService: false, listingsAreAttachable: true },
      );
    } catch (e) {
      if (e instanceof ConflictException) {
        const body = e.getResponse() as { code?: string; matches?: Array<{ signal: string; vendorId: string | null; businessId: string | null }> };
        const m = body.matches?.[0];
        throw new StepError(body.code === 'DUPLICATE_POSSIBLE' ? 'DUPLICATE_POSSIBLE' : 'DUPLICATE_BUSINESS', false, { ...(m?.vendorId ? { existingVendorId: m.vendorId } : {}), ...(m?.businessId ? { existingBusinessId: m.businessId } : {}), ...(m ? { matchedOn: m.signal.toLowerCase() } : {}) });
      }
      if (e instanceof ForbiddenException || e instanceof BadRequestException) throw new StepError('DUPLICATE_OVERRIDE_INVALID', false);
      throw e;
    }
  }

  async run(ctx: StepContext): Promise<StepResult> {
    if (ctx.job.vendorId) {
      if (!(await this.vendors.exists(ctx.job.vendorId))) throw new StepError('UNKNOWN_VENDOR', false);
      return { vendorId: ctx.job.vendorId, outputRef: { vendorId: ctx.job.vendorId } };
    }
    const biz = parseBusinessInput(ctx.input);
    const decision = await this.guard(biz, ctx);
    if (!this.dup) {
      const dup = await this.vendors.findDuplicate(biz.email, biz.phoneKey);
      if (dup) throw new StepError('DUPLICATE_BUSINESS', false, { existingVendorId: dup.id, matchedOn: dup.matched });
    }

    const password = await this.hashPassword();
    const base = slugifySubdomain(biz.businessName);
    for (let n = 1; n <= 30; n++) {
      const subdomain = n === 1 ? base : `${base.slice(0, 36)}-${n}`;
      if (await this.vendors.subdomainTaken(subdomain)) continue;
      try {
        const v = await this.vendors.createForJob(ctx.job.id, {
          name: biz.ownerName, email: biz.email, password, businessName: biz.businessName, phone: biz.phone, phoneKey: biz.phoneKey, industry: biz.category, subdomain,
          status: 'PENDING', source: ctx.job.createdByType === 'STAFF' ? 'STAFF' : 'SYSTEM', registeredByStaffId: ctx.job.createdByType === 'STAFF' ? ctx.job.createdById : null,
        });
        if (decision) await this.dup!.record(decision, v.id);
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
