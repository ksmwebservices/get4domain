import { BadRequestException, ConflictException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateSubdomainSlug } from '../site-domains/core/hostname';
import { domainError, HOST_UNAVAILABLE_MESSAGE } from '../site-domains/site-domains.errors';
import { DomainSettings } from '../site-domains/settings/domain-settings';
import { DomainSettingsService } from '../site-domains/settings/domain-settings.service';
import { Availability, availability, candidateSlug, padToMinimum, slugFromName } from './core/trial-core';
import { DuplicateCheckService } from '../v3-duplicates/duplicate-check.service';

const SLUG_MESSAGES: Record<string, string> = {
  TOO_SHORT: 'That name is too short.', TOO_LONG: 'That name is too long.', BAD_CHARACTERS: 'Use only lowercase letters, digits and hyphens.',
  BAD_EDGE: 'A name cannot start or end with a hyphen.', CONSECUTIVE_HYPHENS: 'A name cannot contain two hyphens in a row.',
};
const MAX_TRIES = 200;

/**
 * Which subdomain a new self-service vendor gets (Wave 3 Part G). A chosen name goes through the SAME rules a vendor's later subdomain change does (length, characters, look-alike folding, the reserved and
 * blocked lists with the mandatory names always included) and must be free. With no choice, a name is made from the business name and numbered until it is both allowed and free: a business called "Admin" gets
 * admin-2, never admin. The public availability check uses the same rules, so what it says is what registering does.
 */
@Injectable()
export class TrialSignupPolicy {
  /** `duplicates` (D1) only adds the similar-address warning to the public check; it never changes what is available. Optional so older tests that build this policy by hand keep working. */
  constructor(private readonly prisma: PrismaService, private readonly settings: DomainSettingsService, @Optional() private readonly duplicates?: DuplicateCheckService) {}

  private rules(s: DomainSettings) { return { min: s.subdomainMinLength, max: s.subdomainMaxLength, reserved: s.reservedSubdomains, blockedWords: s.blockedSubdomainWords }; }

  /** is this slug taken: a vendor's subdomain column, or a host row of any state (a removed host still holds its name) */
  private async taken(slug: string, baseDomain: string): Promise<boolean> {
    const [vendor, host] = await Promise.all([
      this.prisma.vendor.findUnique({ where: { subdomain: slug }, select: { id: true } }),
      this.prisma.v3Domain.findUnique({ where: { hostname: `${slug}.${baseDomain}` }, select: { id: true } }),
    ]);
    return !!vendor || !!host;
  }

  /** The public availability check: valid, not reserved, not taken. Always an answer, never an error. */
  async check(input: unknown): Promise<Availability> {
    const s = await this.settings.get();
    const v = validateSubdomainSlug(input, this.rules(s));
    if (!v.ok) {
      if (v.code === 'BLOCKED') return availability('UNAVAILABLE', null);
      if (v.code === 'RESERVED') return availability('RESERVED', null);
      return availability('INVALID', null, SLUG_MESSAGES[v.code]);
    }
    if (await this.taken(v.slug, s.baseDomain)) return availability('UNAVAILABLE', null);
    const similarTo = await this.duplicates?.subdomainWarning(v.slug);   // a warning, never a block
    return { ...availability('AVAILABLE', v.slug), ...(similarTo ? { similarTo } : {}) };
  }

  /** The subdomain a registration will use. A chosen name that is not allowed or not free is refused with the registered domain codes. */
  async resolveSubdomain(chosen: string | undefined | null, businessName: string): Promise<string> {
    const s = await this.settings.get();
    if (typeof chosen === 'string' && chosen.trim() !== '') {
      const v = validateSubdomainSlug(chosen, this.rules(s));
      if (!v.ok) {
        if (v.code === 'BLOCKED') throw new ConflictException(domainError('HOST_UNAVAILABLE', HOST_UNAVAILABLE_MESSAGE));
        if (v.code === 'RESERVED') throw new BadRequestException(domainError('SUBDOMAIN_RESERVED', 'That name is reserved. Please choose another.'));
        throw new BadRequestException(domainError('SUBDOMAIN_INVALID', SLUG_MESSAGES[v.code] ?? 'That name is not valid.'));
      }
      if (await this.taken(v.slug, s.baseDomain)) throw new ConflictException(domainError('HOST_UNAVAILABLE', HOST_UNAVAILABLE_MESSAGE));
      return v.slug;
    }
    const base = padToMinimum(slugFromName(businessName, s.subdomainMaxLength), s.subdomainMinLength);
    for (let n = 1; n <= MAX_TRIES; n++) {
      const candidate = candidateSlug(base, n, s.subdomainMaxLength);
      const v = validateSubdomainSlug(candidate, this.rules(s));
      if (v.ok && !(await this.taken(v.slug, s.baseDomain))) return v.slug;
    }
    throw new ConflictException(domainError('HOST_UNAVAILABLE', HOST_UNAVAILABLE_MESSAGE));
  }
}
