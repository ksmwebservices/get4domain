import { Injectable } from '@nestjs/common';
import { DirectorySettingsService } from '../settings/directory-settings.service';

/**
 * The SMS seam (slice 5.7). SANDBOX is the default: nothing is sent and the caller keeps the message in the database (the OTP row), which is how staging tests read the code.
 * LIVE is guarded twice: the plan setting smsAdapterMode must be "live" AND the environment flag SMS_LIVE_ENABLED must be "true" (the owner sets it later). Even then no SMS
 * provider is wired in this slice, so a live send fails with ADAPTER_NOT_CONFIGURED instead of pretending: Rule 6 (no mock reports success as live).
 */
export abstract class SmsAdapter {
  /** true = the message must be kept in the database instead of sent */
  abstract isSandbox(): Promise<boolean>;
  abstract send(toE164: string, body: string): Promise<void>;
}

export class SmsNotConfigured extends Error { constructor() { super('ADAPTER_NOT_CONFIGURED'); } }

@Injectable()
export class ModeSmsAdapter extends SmsAdapter {
  /** overridable in tests */
  env: Record<string, string | undefined> = process.env;
  constructor(private readonly settings: DirectorySettingsService) { super(); }

  private async live(): Promise<boolean> { return (await this.settings.get()).smsAdapterMode === 'live' && this.env.SMS_LIVE_ENABLED === 'true'; }

  async isSandbox(): Promise<boolean> { return !(await this.live()); }

  async send(_toE164: string, _body: string): Promise<void> {
    if (!(await this.live())) return;   // sandbox: nothing leaves the process
    throw new SmsNotConfigured();       // live is allowed by the flags but no provider exists yet
  }
}
