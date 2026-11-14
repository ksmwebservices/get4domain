import { Actor } from '../plans/admin/audit.service';
import { SeedInput } from './core/seeded';

/** Creates the vendor shell, the Free plan, the Free site draft and the UNCLAIMED directory profile for one seeded business, through the slice 5.3 job runner (SEEDED mode). */
export abstract class SeedProvisioner {
  abstract provision(i: { input: SeedInput; placeholderEmail: string; idempotencyKey: string; actor: Actor }): Promise<{ vendorId: string; directoryBusinessId: string | null }>;
}

/** Builds and publishes the listing-only Free site. The indexing decision (noindex unless the quality rule and the setting allow) is made by the site build itself. */
export abstract class SeededPublisher {
  abstract publish(vendorId: string, actor: Actor): Promise<{ published: boolean }>;
}

/** The claim link for a seeded business: given to staff ONCE (nothing is emailed or sent), and revoked on request. */
export abstract class ClaimHandover {
  abstract issue(vendorId: string, actor: Actor): Promise<{ claimUrl: string; expiresAt: string }>;
  abstract revoke(vendorId: string, actor: Actor): Promise<number>;
}

/** What the quality check and the views need about the business behind a seeded site. */
export interface BusinessFacts { name: string; categoryKnown: boolean; city: string | null; area: string | null; phoneE164: string | null; businessStatus: string; proActive: boolean; /** a version of the vendor's site is published now (Part B, B1) */ sitePublished?: boolean }
export abstract class SeededFacts {
  abstract factsOf(vendorId: string): Promise<BusinessFacts | null>;
  abstract categoryExists(id: string): boolean;
  abstract trackOf(categoryId: string): string;
}
