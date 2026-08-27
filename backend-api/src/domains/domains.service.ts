import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { DomainRegistration, Vendor, VendorCMS } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ResellerClubService, AvailabilityResult, ResellerClubContactDetails } from './resellerclub.service';
import { RegisterDomainDto } from './dto/register-domain.dto';

// Retail price the vendor pays (paise), per TLD. Admin can later override via
// platform-settings; these defaults mirror the marketing pricing page.
const RETAIL_PRICE_PAISE: Record<string, number> = {
  'in': 59900,
  'co.in': 59900,
  'com': 99900,
  'org': 99900,
  'net': 109900,
  'shop': 129900,
  'store': 149900,
};
const DEFAULT_RETAIL_PAISE = 119900;

// TLDs offered when the search query has no explicit TLD.
const SUGGESTED_TLDS = ['com', 'in', 'co.in', 'net', 'shop'];

export interface DomainSearchResult extends AvailabilityResult {
  pricePaise: number;
  priceLabel: string;
}

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly settings: PlatformSettingsService,
    private readonly resellerClub: ResellerClubService,
  ) {}

  private retailPaiseFor(tld: string): number {
    return RETAIL_PRICE_PAISE[tld.toLowerCase()] ?? DEFAULT_RETAIL_PAISE;
  }

  private static priceLabel(paise: number): string {
    return `₹${Math.round(paise / 100).toLocaleString('en-IN')}/yr`;
  }

  /** Frontend bootstrap: whether registration search is live + this vendor's DNS targets. */
  async configFor(vendorId: string): Promise<{ searchEnabled: boolean; aRecordIp: string; cnameTarget: string }> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { subdomain: true } });
    const searchEnabled = await this.resellerClub.isConfigured();
    const { aRecordIp, cnameTarget } = await this.mappingInstructions(vendor?.subdomain ?? null);
    return { searchEnabled, aRecordIp, cnameTarget };
  }

  /** The DNS records a vendor must set to point a custom domain at the platform. */
  async mappingInstructions(subdomain: string | null): Promise<{ aRecordIp: string; cnameTarget: string }> {
    const aRecordIp = process.env.SERVER_IP ?? '34.14.130.68';
    const cnameTarget = subdomain ? `${subdomain}.get4domain.com` : 'yourbusiness.get4domain.com';
    return { aRecordIp, cnameTarget };
  }

  /**
   * Real availability + price via ResellerClub. Throws RESELLERCLUB_NOT_CONFIGURED
   * (503) until credentials are set — the frontend renders a "coming soon" state
   * for that, never fabricated availability.
   */
  async search(query: string): Promise<DomainSearchResult[]> {
    const cleaned = query.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const hasTld = cleaned.includes('.');
    const { sld } = ResellerClubService.splitDomain(cleaned);
    const tlds = hasTld
      ? Array.from(new Set([ResellerClubService.splitDomain(cleaned).tld, ...SUGGESTED_TLDS]))
      : SUGGESTED_TLDS;

    const results = await this.resellerClub.checkAvailability(sld, tlds);
    return results.map((r) => {
      const pricePaise = this.retailPaiseFor(r.tld);
      return { ...r, pricePaise, priceLabel: DomainsService.priceLabel(pricePaise) };
    });
  }

  listMine(vendorId: string): Promise<DomainRegistration[]> {
    return this.prisma.domainRegistration.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Assemble the ResellerClub registrant details from the vendor's own profile.
   * The vendor's identity (name/company/email/phone/address-line-1) is real; the
   * structured fields the profile doesn't capture (city/state/zipcode) come from
   * admin-set defaults. Returns null when those defaults or a usable phone are
   * missing, so we don't fire a call that ResellerClub is guaranteed to reject.
   */
  private async buildRegistrantDetails(vendor: Vendor & { cms: VendorCMS | null }): Promise<ResellerClubContactDetails | null> {
    const [city, state, country, zipcode] = await Promise.all([
      this.settings.getResolvedValue('domain', 'default_reg_city'),
      this.settings.getResolvedValue('domain', 'default_reg_state'),
      this.settings.getResolvedValue('domain', 'default_reg_country'),
      this.settings.getResolvedValue('domain', 'default_reg_zipcode'),
    ]);
    if (!city || !state || !zipcode) return null;

    const rawPhone = (vendor.phone ?? vendor.cms?.phone ?? '').replace(/\D/g, '');
    const phone = rawPhone.length > 10 ? rawPhone.slice(-10) : rawPhone;
    if (phone.length < 10) return null;

    return {
      name: vendor.name,
      company: vendor.businessName || vendor.name,
      email: vendor.email,
      addressLine1: (vendor.cms?.address || vendor.businessName || vendor.name).slice(0, 64),
      city,
      state,
      country: country || 'IN',
      zipcode,
      phoneCc: '91',
      phone,
    };
  }

  /**
   * Resolve the ResellerClub customer/contact this vendor's domains register
   * under. Lazily creates a PER-VENDOR customer + contact from the vendor's own
   * details on first use and stores the ids on the Vendor. If per-vendor creation
   * fails (or registrant defaults aren't set), falls back to the SHARED default —
   * logged loudly so the shared account isn't silently reused long-term.
   */
  private async ensureVendorResellerClubIdentity(vendorId: string): Promise<{ customerId: string | null; contactId: string | null }> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, include: { cms: true } });
    if (!vendor) return { customerId: null, contactId: null };

    if (vendor.resellerClubCustomerId && vendor.resellerClubContactId) {
      return { customerId: vendor.resellerClubCustomerId, contactId: vendor.resellerClubContactId };
    }

    const details = await this.buildRegistrantDetails(vendor);
    if (details) {
      try {
        // Reuse a customer id from a prior partial attempt; only the contact is missing.
        let customerId = vendor.resellerClubCustomerId;
        if (!customerId) {
          customerId = await this.resellerClub.signupCustomer(details);
          await this.prisma.vendor.update({ where: { id: vendorId }, data: { resellerClubCustomerId: customerId } });
        }
        const contactId = await this.resellerClub.addContact(customerId, details);
        await this.prisma.vendor.update({ where: { id: vendorId }, data: { resellerClubContactId: contactId } });
        this.logger.log(`Per-vendor ResellerClub identity created for vendor ${vendorId} (customer ${customerId}, contact ${contactId})`);
        return { customerId, contactId };
      } catch (err) {
        this.logger.warn(`Per-vendor ResellerClub identity FAILED for vendor ${vendorId}; falling back to SHARED default. Reason: ${err instanceof Error ? err.message : 'error'}`);
      }
    } else {
      this.logger.warn(`Registrant defaults not set — using SHARED ResellerClub default for vendor ${vendorId}. Set default_reg_city/state/zipcode to enable per-vendor identity.`);
    }

    const [sharedCustomer, sharedContact] = await Promise.all([
      this.settings.getResolvedValue('domain', 'resellerclub_customer_id'),
      this.settings.getResolvedValue('domain', 'resellerclub_contact_id'),
    ]);
    return { customerId: sharedCustomer, contactId: sharedContact };
  }

  /**
   * Buy a domain, charged to the vendor's wallet (confirmed payment flow,
   * 27-Aug-2026). Money-safe by construction: the wallet is debited first, and
   * if the registrar call fails the debit is refunded before we surface the
   * error — a failed registration never leaves the vendor charged.
   */
  async register(vendorId: string, dto: RegisterDomainDto): Promise<DomainRegistration> {
    const domain = dto.domain.trim().toLowerCase();
    const { tld } = ResellerClubService.splitDomain(domain);
    const years = dto.years ?? 1;

    // Reject duplicates up front (also enforced by the @@unique index).
    const existing = await this.prisma.domainRegistration.findUnique({
      where: { vendorId_domainName: { vendorId, domainName: domain } },
    });
    if (existing) {
      throw new BadRequestException('You already have this domain on your account.');
    }

    // Confirm still available before taking any money.
    const [availability] = await this.resellerClub.checkAvailability(
      ResellerClubService.splitDomain(domain).sld,
      [tld],
    );
    if (!availability || !availability.available) {
      throw new BadRequestException('That domain is no longer available.');
    }

    // Resolve name servers (shared) + this vendor's ResellerClub customer/contact
    // (per-vendor, created lazily here). Fail BEFORE charging if the registrar
    // isn't fully set up (no half-finished purchases).
    const [ns1, ns2] = await Promise.all([
      this.settings.getResolvedValue('domain', 'resellerclub_ns1'),
      this.settings.getResolvedValue('domain', 'resellerclub_ns2'),
    ]);
    if (!ns1 || !ns2) {
      throw new ServiceUnavailableException('DOMAIN_REGISTRATION_NOT_CONFIGURED');
    }
    const { customerId, contactId } = await this.ensureVendorResellerClubIdentity(vendorId);
    if (!customerId || !contactId) {
      throw new ServiceUnavailableException('DOMAIN_REGISTRATION_NOT_CONFIGURED');
    }

    const pricePaise = this.retailPaiseFor(tld) * years;
    if (!(await this.wallet.hasSufficientBalance(vendorId, pricePaise))) {
      throw new BadRequestException('INSUFFICIENT_WALLET_BALANCE');
    }

    // 1) Charge the wallet.
    await this.wallet.deduct(vendorId, pricePaise, `Domain registration — ${domain} (${years}yr)`, 'domain_registration');

    // 2) Register with the registrar; refund on any failure.
    let orderId: string;
    try {
      const result = await this.resellerClub.registerDomain({
        domain,
        years,
        customerId,
        regContactId: contactId,
        adminContactId: contactId,
        techContactId: contactId,
        billingContactId: contactId,
        ns: [ns1, ns2],
      });
      orderId = result.orderId;
    } catch (err) {
      await this.wallet.grantCredit(
        vendorId,
        pricePaise,
        `Refund — domain registration failed for ${domain}`,
        'domain_refund',
      );
      this.logger.error(`Domain registration failed for ${domain}, wallet refunded: ${err instanceof Error ? err.message : 'error'}`);
      throw new ServiceUnavailableException('DOMAIN_REGISTRATION_FAILED');
    }

    // 3) Persist. Registered but not yet pointed at us → mapping_pending.
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + years);
    return this.prisma.domainRegistration.create({
      data: {
        vendorId,
        domainName: domain,
        tld,
        source: 'registered',
        registrar: 'resellerclub',
        registrarOrderId: orderId,
        status: 'mapping_pending',
        pricePaise,
        years,
        expiresAt,
      },
    });
  }

  /** Record an externally-owned domain the vendor wants to point at the platform. */
  async connect(vendorId: string, domainRaw: string): Promise<DomainRegistration> {
    const domain = domainRaw.trim().toLowerCase().replace(/^www\./, '');
    const { tld } = ResellerClubService.splitDomain(domain);
    return this.prisma.domainRegistration.upsert({
      where: { vendorId_domainName: { vendorId, domainName: domain } },
      create: { vendorId, domainName: domain, tld, source: 'connected', registrar: 'external', status: 'mapping_pending', pricePaise: 0 },
      update: {},
    });
  }

  /**
   * Check whether DNS actually points at the platform yet, and flip the domain to
   * "active" once it does. Real lookup — an A record equal to our server IP, or a
   * CNAME pointing at *.get4domain.com.
   */
  async verifyMapping(vendorId: string, domainRaw: string): Promise<{ status: string; propagated: boolean; detail: string }> {
    const domain = domainRaw.trim().toLowerCase().replace(/^www\./, '');
    const record = await this.prisma.domainRegistration.findUnique({
      where: { vendorId_domainName: { vendorId, domainName: domain } },
    });
    if (!record) {
      throw new BadRequestException('Domain not found on your account. Add it under "Connect Domain" first.');
    }

    const serverIp = process.env.SERVER_IP ?? '34.14.130.68';
    let propagated = false;
    let mappingType: string | null = null;
    let detail = 'DNS records not found yet. Propagation can take up to 24 hours.';

    try {
      const aRecords = await dns.resolve4(domain).catch(() => [] as string[]);
      if (aRecords.includes(serverIp)) {
        propagated = true;
        mappingType = 'A';
        detail = 'A record verified.';
      }
    } catch { /* ignore, try CNAME */ }

    if (!propagated) {
      try {
        const cnames = await dns.resolveCname(`www.${domain}`).catch(() => [] as string[]);
        if (cnames.some((c) => c.toLowerCase().endsWith('.get4domain.com'))) {
          propagated = true;
          mappingType = 'CNAME';
          detail = 'CNAME record verified.';
        }
      } catch { /* not propagated */ }
    }

    if (propagated) {
      await this.prisma.domainRegistration.update({
        where: { vendorId_domainName: { vendorId, domainName: domain } },
        data: { status: 'active', mappingType, mappingVerifiedAt: new Date() },
      });
    }

    return { status: propagated ? 'active' : record.status, propagated, detail };
  }
}
