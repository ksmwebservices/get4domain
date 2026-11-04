import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DirectoryRepository } from '../directory/directory.repository';
import { Actor } from '../plans/admin/audit.service';
import { ClaimsService } from '../provisioning/claims/claims.service';
import { ClaimStore } from '../provisioning/claims/claim-store';
import { ProvisioningRepository } from '../provisioning/provisioning.repository';
import { JobRunnerService } from '../provisioning/runner/job-runner.service';
import { PublishService } from '../site-publish/publish/publish.service';
import { SiteBuildService } from '../site-publish/publish/site-build.service';
import { ThemeRenderService } from '../site-publish/renderer/theme-render.service';
import { b3Error } from '../b3-settings/b3-errors';
import { SeedInput } from './core/seeded';
import { BusinessFacts, ClaimHandover, SeedProvisioner, SeededFacts, SeededPublisher } from './seeded-ports';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

/** Creates the job (idempotent on its key) and runs THAT job to the end with the real runner. A failure is reported with the runner's own stable code. */
@Injectable()
export class JobSeedProvisioner extends SeedProvisioner {
  constructor(private readonly jobs: ProvisioningRepository, private readonly runner: JobRunnerService, private readonly directory: DirectoryRepository, private readonly facts: SeededFacts) { super(); }

  async provision(i: { input: SeedInput; placeholderEmail: string; idempotencyKey: string; actor: Actor }) {
    const s = i.input;
    const { job } = await this.jobs.createJob({
      idempotencyKey: i.idempotencyKey, maxAttempts: 3, createdByType: 'STAFF', createdById: i.actor.id,
      input: {
        mode: 'SEEDED', businessName: s.businessName, track: this.facts.trackOf(s.category), category: s.category, city: s.city, language: 'en', phone: s.phone, placeholderEmail: i.placeholderEmail,
        area: s.area, addressLine: s.address || undefined, description: s.description || undefined,
      },
    });
    const report = await this.runner.runOne({ jobId: job.id });
    const done = await this.jobs.getJob(job.id);
    if (!done || done.status !== 'SUCCEEDED' || !done.vendorId) {
      throw new UnprocessableEntityException(b3Error('SEEDED_INVALID', 'The site could not be created. Nothing was published.', { jobId: job.id, code: done?.lastErrorCode ?? report?.status ?? 'UNEXPECTED' }));
    }
    const biz = await this.directory.getBusinessByVendor(done.vendorId);
    return { vendorId: done.vendorId, directoryBusinessId: biz?.id ?? null };
  }
}

/** Builds the draft and publishes it. Both services are found lazily so this module does not import the site-publish module at start. */
@Injectable()
export class ModuleSeededPublisher extends SeededPublisher {
  constructor(private readonly modules: ModuleRef) { super(); }
  async publish(vendorId: string, actor: Actor): Promise<{ published: boolean }> {
    const build = this.modules.get(SiteBuildService, { strict: false });
    const publish = this.modules.get(PublishService, { strict: false });
    const { publication } = await build.build(vendorId, { actor });
    if (publication.status === 'PUBLISHED') return { published: true };
    await publish.publish(vendorId, publication.id, actor);
    return { published: true };
  }
}

@Injectable()
export class ClaimsHandover extends ClaimHandover {
  constructor(private readonly claims: ClaimsService, private readonly store: ClaimStore) { super(); }
  async issue(vendorId: string, actor: Actor) {
    if (await this.store.hasUsedToken(vendorId)) throw new ConflictException(b3Error('SEEDED_REMOVED', 'This business has already been claimed.'));
    const r = await this.claims.issueForHandover(vendorId, actor);
    return { claimUrl: r.claimUrl, expiresAt: r.expiresAt };
  }
  async revoke(vendorId: string, actor: Actor) { return (await this.claims.revoke(vendorId, actor)).revoked; }
}

/** Facts from the directory profile (name, city, area, phone) and the kit's category list. */
@Injectable()
export class DirectorySeededFacts extends SeededFacts {
  constructor(private readonly directory: DirectoryRepository, private readonly themes: ThemeRenderService) { super(); }
  categoryExists(id: string): boolean { return this.themes.kitApi.hasCategory(id); }
  trackOf(categoryId: string): string { return this.themes.kitApi.categoryById(categoryId).track; }
  async factsOf(vendorId: string): Promise<BusinessFacts | null> {
    const b = await this.directory.getBusinessByVendor(vendorId);
    if (!b) return null;
    const site = (await this.directory.siteFacts([vendorId], new Date())).get(vendorId);
    return { name: b.name, categoryKnown: !!b.categoryId, city: b.address.city ?? null, area: b.address.line2 ?? null, phoneE164: b.phoneE164, businessStatus: b.status, proActive: site?.proActive === true };
  }
}
