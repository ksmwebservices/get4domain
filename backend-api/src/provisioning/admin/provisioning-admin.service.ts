import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../../plans/admin/audit.service';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { canCancel, canRetry, cancelPlan } from '../core/state-machine';
import { InviteStore } from '../invites/invite-store';
import { JobRunnerService, ProvisioningAudit } from '../runner/job-runner.service';
import { ProvisioningRepository } from '../provisioning.repository';
import { ProvisioningSettingsService } from '../settings/provisioning-settings.service';
import { StepError } from '../provisioning.errors';
import { parseBusinessInput } from '../steps/business-input';
import { IDEMPOTENCY_KEY, CreateProvisioningJobDto, ListInvitesQueryDto, ListJobsQueryDto } from './dto/provisioning.dto';
import { presentInvite, presentJob, presentStep } from './provisioning-admin.shape';

const jobNotFound = (): NotFoundException => new NotFoundException({ message: 'That provisioning job does not exist.', code: 'JOB_NOT_FOUND' });
const notRetryable = (what: string): ConflictException => new ConflictException({ message: what, code: 'JOB_NOT_RETRYABLE' });

/** Staff operations on provisioning jobs. Rules only; HTTP is in the controller. Every change is audited with ids and codes, never a token. */
@Injectable()
export class ProvisioningAdminService {
  constructor(
    private readonly repo: ProvisioningRepository,
    private readonly runner: JobRunnerService,
    private readonly settings: ProvisioningSettingsService,
    private readonly audit: ProvisioningAudit,
    private readonly invites: InviteStore,
  ) {}

  /** Creates the job, or returns the existing one for the same Idempotency-Key (`created: false`). */
  async createJob(dto: CreateProvisioningJobDto, idempotencyKey: string | undefined, actor: Actor) {
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) throw new BadRequestException('The Idempotency-Key header is required: 8 to 100 letters, digits or - _ . :');
    let input;
    try { input = parseBusinessInput(dto); } catch (e) { if (e instanceof StepError) throw new BadRequestException('One of the business details is not valid. Check the phone number and the email address.'); throw e; }
    const s = await this.settings.get();
    const { job, created } = await this.repo.createJob({
      idempotencyKey,
      input: { businessName: input.businessName, track: input.track, category: input.category, ownerName: input.ownerName, phone: input.phone, email: input.email, city: input.city, language: input.language },
      maxAttempts: s.provisioningMaxAttempts, createdByType: 'STAFF', createdById: actor.id,
    });
    if (created) await this.audit.record(actor, 'provisioning.job.created', 'provisioning_job', job.id, { kind: job.kind, track: input.track });
    return { created, job: presentJob(job, true) };
  }

  async list(q: ListJobsQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const { items, total } = await this.repo.listJobs({ status: q.status, from: q.from ? new Date(q.from) : undefined, to: q.to ? new Date(q.to) : undefined, skip, take });
    return paged(items.map((j) => presentJob(j)), total, page, pageSize);
  }

  async detail(id: string) {
    const job = await this.repo.getJob(id);
    if (!job) throw jobNotFound();
    return { ...presentJob(job, true), steps: (await this.repo.listSteps(id)).map(presentStep) };
  }

  async retry(id: string, actor: Actor) {
    const job = await this.repo.getJob(id);
    if (!job) throw jobNotFound();
    if (!canRetry(job.status)) throw notRetryable('Only a failed job can be retried.');
    await this.repo.resetForRetry(id, new Date());
    await this.audit.record(actor, 'provisioning.job.retry', 'provisioning_job', id, { from: job.status, lastErrorCode: job.lastErrorCode });
    return this.detail(id);
  }

  async cancel(id: string, actor: Actor) {
    const job = await this.repo.getJob(id);
    if (!job) throw jobNotFound();
    const now = new Date();
    if (!canCancel(job, now)) throw notRetryable(job.status === 'RUNNING' ? 'Another runner is working on this job right now. Try again in a few minutes.' : 'This job has already finished.');
    await this.repo.cancel(id, now, cancelPlan(await this.repo.listSteps(id)));
    await this.audit.record(actor, 'provisioning.job.cancel', 'provisioning_job', id, { from: job.status });
    return this.detail(id);
  }

  /** Runs one job now, in this request (staging and tests, or staff in production while the runner is switched on). */
  async run(id: string, actor: Actor) {
    const s = await this.settings.get();
    if (process.env.NODE_ENV === 'production' && !s.provisioningRunnerEnabled) throw new ForbiddenException('Running a job by hand is switched off until provisioningRunnerEnabled is true.');
    const job = await this.repo.getJob(id);
    if (!job) throw jobNotFound();
    if (job.status !== 'QUEUED' && job.status !== 'WAITING') throw notRetryable(job.status === 'FAILED' ? 'This job failed. Retry it first.' : 'This job cannot be run now.');
    await this.repo.makeDue(id, new Date());
    const report = await this.runner.runOne({ jobId: id });
    if (!report) throw notRetryable('This job cannot be run now.');
    await this.audit.record(actor, 'provisioning.job.run', 'provisioning_job', id, { result: report.status });
    return this.detail(id);
  }

  async listInvites(q: ListInvitesQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const { items, total } = await this.invites.list({ skip, take, vendorId: q.vendorId });
    const showBody = process.env.NODE_ENV !== 'production';   // the sandbox body holds the claim link: staging only
    return paged(items.map((i) => presentInvite(i, showBody)), total, page, pageSize);
  }
}
