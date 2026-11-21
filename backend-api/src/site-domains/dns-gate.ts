import { Injectable } from '@nestjs/common';
import { DnsResolver } from './core/verification';
import { DomainSettingsService } from './settings/domain-settings.service';

/** The real resolver (node dns). Only ever constructed by DnsGate, and only while the setting domainDnsLiveChecks is true. */
export class NodeDnsResolver implements DnsResolver {
  constructor(private readonly timeoutMs = 5000) {}
  async resolveTxt(name: string): Promise<string[][]> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resolver } = require('dns').promises as typeof import('dns').promises;
    const r = new Resolver();
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        r.resolveTxt(name),
        new Promise<never>((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('dns timeout'), { code: 'ETIMEOUT' })), this.timeoutMs); }),
      ]);
    } finally { if (timer) clearTimeout(timer); r.cancel(); }
  }
}

/** null = live DNS checks are switched off (the default): the caller must not query DNS. The real resolver is created lazily, the first time it is allowed. */
@Injectable()
export class DnsGate {
  private real: NodeDnsResolver | null = null;
  constructor(private readonly settings: DomainSettingsService) {}
  async resolver(): Promise<DnsResolver | null> {
    if (!(await this.settings.get()).domainDnsLiveChecks) return null;
    return (this.real ??= new NodeDnsResolver());
  }
}
