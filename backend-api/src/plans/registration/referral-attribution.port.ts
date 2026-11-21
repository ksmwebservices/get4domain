/**
 * The seam between self-registration and the referral module (Wave 3 Part I): a vendor who registers with a referral code is attributed to its source (first touch wins). Best effort: it never raises and
 * never blocks a signup, and a code that does not resolve, or a self-referral, simply records nothing. An abstract class so the auth module imports nothing from the referral module; absent = no attribution.
 */
export abstract class ReferralAttributionPort {
  abstract attributeAtRegistration(i: { vendorId: string; code: string }): Promise<void>;
}
