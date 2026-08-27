import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

/** Registrant/customer details assembled from the vendor's own profile. */
export interface ResellerClubContactDetails {
  name: string;
  company: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  country: string; // ISO 2-letter, e.g. IN
  zipcode: string;
  phoneCc: string; // e.g. 91
  phone: string; // digits only
}

export interface AvailabilityResult {
  domain: string;
  sld: string;
  tld: string;
  available: boolean;
  /** Raw ResellerClub status: available | regthroughus | regthroughothers | unknown */
  status: string;
}

/**
 * Thin client for the ResellerClub / LogicBoxes HTTP API (httpapi.com).
 *
 * Credentials come from Admin → Integrations → "Domain (ResellerClub)"
 * (platform-settings category "domain"), with env fallback — NEVER hard-coded.
 * Until an api-key + reseller id are configured, every call throws
 * RESELLERCLUB_NOT_CONFIGURED rather than returning fabricated results
 * (dispatch 26-Aug-2026, Phase 2: "don't fake it").
 *
 * NOTE: written against the documented ResellerClub HTTP API but not yet
 * verified against a live account. Set RESELLERCLUB_API_BASE to the OT&E/test
 * host (https://test.httpapi.com/api) for sandbox testing before production.
 */
@Injectable()
export class ResellerClubService {
  private readonly logger = new Logger(ResellerClubService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  private get apiBase(): string {
    return process.env.RESELLERCLUB_API_BASE ?? 'https://httpapi.com/api';
  }

  private async credentials(): Promise<{ authUserId: string; apiKey: string }> {
    const [apiKey, authUserId] = await Promise.all([
      this.settings.getResolvedValue('domain', 'resellerclub_api_key'),
      this.settings.getResolvedValue('domain', 'resellerclub_reseller_id'),
    ]);
    if (!apiKey || !authUserId) {
      throw new ServiceUnavailableException('RESELLERCLUB_NOT_CONFIGURED');
    }
    return { authUserId, apiKey };
  }

  async isConfigured(): Promise<boolean> {
    try {
      await this.credentials();
      return true;
    } catch {
      return false;
    }
  }

  /** Split "my-shop.co.in" → { sld: "my-shop", tld: "co.in" }. */
  static splitDomain(domain: string): { sld: string; tld: string } {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const firstDot = clean.indexOf('.');
    if (firstDot === -1) return { sld: clean, tld: 'com' };
    return { sld: clean.slice(0, firstDot), tld: clean.slice(firstDot + 1) };
  }

  /**
   * Check availability for one SLD across one or more TLDs.
   * GET /domains/available.json?auth-userid&api-key&domain-name&tlds=...
   */
  async checkAvailability(sld: string, tlds: string[]): Promise<AvailabilityResult[]> {
    const { authUserId, apiKey } = await this.credentials();
    const params = new URLSearchParams();
    params.set('auth-userid', authUserId);
    params.set('api-key', apiKey);
    params.set('domain-name', sld);
    for (const tld of tlds) params.append('tlds', tld);

    let payload: Record<string, { status?: string }>;
    try {
      const res = await fetch(`${this.apiBase}/domains/available.json?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`ResellerClub availability HTTP ${res.status}`);
      }
      payload = (await res.json()) as Record<string, { status?: string }>;
    } catch (err) {
      this.logger.error(`ResellerClub availability failed: ${err instanceof Error ? err.message : 'error'}`);
      throw new ServiceUnavailableException('RESELLERCLUB_UNAVAILABLE');
    }

    return Object.entries(payload).map(([domain, info]) => {
      const status = info?.status ?? 'unknown';
      const dot = domain.indexOf('.');
      return {
        domain,
        sld: dot === -1 ? domain : domain.slice(0, dot),
        tld: dot === -1 ? '' : domain.slice(dot + 1),
        available: status === 'available',
        status,
      };
    });
  }

  /** Generate a ResellerClub-compliant customer password (8–15 chars, mixed). */
  private static randomPassword(): string {
    const rand = crypto.randomBytes(6).toString('hex'); // 12 hex chars
    return `Aa1!${rand}`.slice(0, 15);
  }

  /**
   * Create a ResellerClub Customer from the vendor's own business details.
   * POST /customers/v2/signup.json — returns the numeric customer-id (body).
   * The generated account password is not persisted (RC panel can reset it);
   * the vendor never uses this sub-account directly.
   */
  async signupCustomer(d: ResellerClubContactDetails): Promise<string> {
    const { authUserId, apiKey } = await this.credentials();
    const params = new URLSearchParams();
    params.set('auth-userid', authUserId);
    params.set('api-key', apiKey);
    params.set('username', d.email);
    params.set('passwd', ResellerClubService.randomPassword());
    params.set('name', d.name);
    params.set('company', d.company);
    params.set('address-line-1', d.addressLine1);
    params.set('city', d.city);
    params.set('state', d.state);
    params.set('country', d.country);
    params.set('zipcode', d.zipcode);
    params.set('phone-cc', d.phoneCc);
    params.set('phone', d.phone);
    params.set('lang-pref', 'en');

    const res = await fetch(`${this.apiBase}/customers/v2/signup.json?${params.toString()}`, { method: 'POST' });
    const raw = (await res.json()) as unknown;
    if (!res.ok) {
      const msg = typeof raw === 'object' && raw && 'message' in raw ? String((raw as { message: unknown }).message) : `HTTP ${res.status}`;
      throw new Error(`ResellerClub customer signup failed: ${msg}`);
    }
    // Success returns the bare customer-id (number or numeric string).
    const customerId = String(raw).trim();
    if (!/^\d+$/.test(customerId)) {
      throw new Error(`ResellerClub customer signup returned no id: ${JSON.stringify(raw)}`);
    }
    return customerId;
  }

  /**
   * Add a Contact under a customer. POST /contacts/add.json — returns the numeric
   * contact-id. Used as reg/admin/tech/billing contact for that customer's domains.
   */
  async addContact(customerId: string, d: ResellerClubContactDetails): Promise<string> {
    const { authUserId, apiKey } = await this.credentials();
    const params = new URLSearchParams();
    params.set('auth-userid', authUserId);
    params.set('api-key', apiKey);
    params.set('name', d.name);
    params.set('company', d.company);
    params.set('email', d.email);
    params.set('address-line-1', d.addressLine1);
    params.set('city', d.city);
    params.set('state', d.state);
    params.set('country', d.country);
    params.set('zipcode', d.zipcode);
    params.set('phone-cc', d.phoneCc);
    params.set('phone', d.phone);
    params.set('customer-id', customerId);
    params.set('type', 'Contact');

    const res = await fetch(`${this.apiBase}/contacts/add.json?${params.toString()}`, { method: 'POST' });
    const raw = (await res.json()) as unknown;
    if (!res.ok) {
      const msg = typeof raw === 'object' && raw && 'message' in raw ? String((raw as { message: unknown }).message) : `HTTP ${res.status}`;
      throw new Error(`ResellerClub contact add failed: ${msg}`);
    }
    const contactId = String(raw).trim();
    if (!/^\d+$/.test(contactId)) {
      throw new Error(`ResellerClub contact add returned no id: ${JSON.stringify(raw)}`);
    }
    return contactId;
  }

  /**
   * Submit a domain registration. Live registration additionally requires a
   * ResellerClub customer-id + registrant/admin/tech/billing contact-ids and
   * name-servers; those are provisioned from the vendor's registrant details
   * (a KYC-style form) and the platform's default NS. That provisioning is
   * account-specific and MUST be verified against the live ResellerClub account
   * — this method is structured per the documented /domains/register.json call
   * and returns the registrar order id on success.
   */
  async registerDomain(opts: {
    domain: string;
    years: number;
    customerId: string;
    regContactId: string;
    adminContactId: string;
    techContactId: string;
    billingContactId: string;
    ns: string[];
  }): Promise<{ orderId: string; raw: unknown }> {
    const { authUserId, apiKey } = await this.credentials();
    const params = new URLSearchParams();
    params.set('auth-userid', authUserId);
    params.set('api-key', apiKey);
    params.set('domain-name', opts.domain);
    params.set('years', String(opts.years));
    params.set('customer-id', opts.customerId);
    params.set('reg-contact-id', opts.regContactId);
    params.set('admin-contact-id', opts.adminContactId);
    params.set('tech-contact-id', opts.techContactId);
    params.set('billing-contact-id', opts.billingContactId);
    for (const ns of opts.ns) params.append('ns', ns);
    params.set('invoice-option', 'NoInvoice');

    const res = await fetch(`${this.apiBase}/domains/register.json?${params.toString()}`, { method: 'POST' });
    const raw = (await res.json()) as { entityid?: string | number; status?: string; message?: string };
    if (!res.ok || (raw.status && raw.status.toLowerCase() === 'error')) {
      throw new Error(`ResellerClub register failed: ${raw.message ?? `HTTP ${res.status}`}`);
    }
    return { orderId: String(raw.entityid ?? ''), raw };
  }
}
