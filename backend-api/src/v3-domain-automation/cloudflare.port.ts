import { CertStatus } from './core/connection-core';

export interface HostnameState { id: string; hostname: string; certStatus: CertStatus; reason?: string }

/** Raised by a port when the provider is down or refuses: `retryable` decides whether the service tries again. */
export class CloudflareError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); this.name = 'CloudflareError'; }
}

/**
 * Cloudflare custom hostnames and redirect rules (slice 5.6c). NEVER called live in this run: the only bindings are the unavailable port (production default) and the fake in test/support.
 * A real adapter belongs to the owner's later live step; none is written here.
 */
export abstract class CloudflarePort {
  abstract createCustomHostname(hostname: string): Promise<HostnameState>;
  abstract getCustomHostname(id: string): Promise<HostnameState>;
  abstract deleteCustomHostname(id: string): Promise<void>;
  abstract setRedirect(fromHost: string, toHost: string, status: 301 | 302): Promise<void>;
  abstract removeRedirect(fromHost: string): Promise<void>;
}

/** The default binding: automatic connection is not switched on, so every call says so. Nothing is faked. */
export class UnavailableCloudflarePort extends CloudflarePort {
  private no(): never { throw new CloudflareError('CLOUDFLARE_NOT_ENABLED', false); }
  async createCustomHostname(): Promise<HostnameState> { return this.no(); }
  async getCustomHostname(): Promise<HostnameState> { return this.no(); }
  async deleteCustomHostname(): Promise<void> { this.no(); }
  async setRedirect(): Promise<void> { this.no(); }
  async removeRedirect(): Promise<void> { this.no(); }
}
