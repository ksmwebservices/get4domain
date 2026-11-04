import { Injectable } from '@nestjs/common';
import { maskEmail } from '../../directory/core/masking';
import { normalisePhoneE164 } from '../../directory/core/otp';
import { businessSlug } from '../../directory/core/slug';
import { DirectoryAdminService } from '../../directory/directory-admin.service';
import { DirectoryAudit } from '../../directory/directory-audit';
import { DirectoryRepository } from '../../directory/directory.repository';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { parseBusinessInput } from './business-input';

/**
 * OPTIONAL step 3b (slice 5.7), run only when the plan setting provisioningDirectoryProfileEnabled is true. Creates an UNCLAIMED public directory business for the new vendor from the
 * same input as the job. Idempotent for a vendor (a second run returns the same business). The business stays unclaimed, and not indexable unless the setting
 * directoryIndexUnclaimed allows it, until the owner claims it by phone OTP. A category the directory does not know yet (seed not loaded) is a permanent, plainly named failure.
 */
@Injectable()
export class CreateDirectoryProfileStep implements ProvisioningStep {
  readonly key = 'CREATE_DIRECTORY_PROFILE' as const;
  constructor(private readonly repo: DirectoryRepository, private readonly admin: DirectoryAdminService, private readonly audit: DirectoryAudit) {}

  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.vendorId) throw new StepError('UNKNOWN_VENDOR', false);
    const existing = await this.repo.getBusinessByVendor(ctx.vendorId);
    if (existing) return { outputRef: { businessId: existing.id } };

    const b = parseBusinessInput(ctx.input);
    const cat = (await this.repo.listCategories()).find((c) => c.themeCategoryId === b.category);
    if (!cat) throw new StepError('DIRECTORY_CATEGORY_MISSING', false);
    const locs = await this.repo.listLocations();
    const city = (b.city ?? '').trim().toLowerCase();
    const loc = city ? (locs.find((l) => l.kind === 'CITY' && l.name.toLowerCase() === city) ?? locs.find((l) => l.kind === 'DISTRICT' && l.name.toLowerCase() === city)) : undefined;
    const phone = b.phone ? normalisePhoneE164(b.phone) : null;

    const draft = { status: 'UNCLAIMED' as const, name: b.businessName, categoryId: cat.id, locationId: loc?.id ?? null, phoneE164: phone, address: { ...(b.city ? { city: b.city } : {}), ...(b.addressLine ? { line1: b.addressLine } : {}), ...(b.area ? { line2: b.area } : {}) }, descriptionText: b.description ?? '' };
    const indexable = await this.admin.indexableFor(draft);
    const row = await this.admin.createWithSlug(businessSlug(b.businessName, loc?.name ?? b.city), (slug) => this.repo.createBusiness({
      vendorId: ctx.vendorId!, slug, name: b.businessName, categoryId: cat.id, locationId: loc?.id ?? null, address: draft.address, phoneE164: phone,
      emailMasked: maskEmail(b.email) || null, hours: {}, geo: null, descriptionText: '', status: 'UNCLAIMED', indexable, source: 'PROVISIONING',
    }));
    await this.audit.record(ctx.actor, 'directory.business.provisioned', 'directory_business', row.id, null, { vendorId: ctx.vendorId, slug: row.slug, categoryId: cat.id, locationId: row.locationId });
    return { outputRef: { businessId: row.id } };
  }
}
