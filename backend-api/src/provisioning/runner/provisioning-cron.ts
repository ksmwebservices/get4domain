import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobRunnerService } from './job-runner.service';
import { ProvisioningSettingsService } from '../settings/provisioning-settings.service';

/**
 * The tick that runs due jobs, only while the plan setting provisioningRunnerEnabled is true (default false: nothing runs by itself). One tick at a time per
 * process; across processes the atomic claim keeps two runners off the same job. No Redis, no queue: the database is the queue (decision D4).
 */
@Injectable()
export class ProvisioningCron {
  private readonly logger = new Logger(ProvisioningCron.name);
  private busy = false;

  constructor(private readonly runner: JobRunnerService, private readonly settings: ProvisioningSettingsService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!(await this.settings.get()).provisioningRunnerEnabled) return;
      const reports = await this.runner.runDue(5);
      if (reports.length) this.logger.log(`ran ${reports.length} provisioning job(s)`);
    } catch (e) {
      this.logger.error(`provisioning tick failed: ${e instanceof Error ? e.name : 'error'}`);   // the message can echo a connection string; the name cannot
    } finally {
      this.busy = false;
    }
  }
}
