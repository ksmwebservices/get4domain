/**
 * What the rest of the platform may ask of the terms module (slice 5.15). Both are abstract so a module that does not import slice 5.15 (and a unit test) can leave them out:
 * an absent guard means "no check", which is how a build without terms behaves.
 */
export abstract class AcceptanceGuard {
  /** Throws 403 TERMS_ACCEPTANCE_REQUIRED unless the vendor accepted the latest PUBLISHED version of every given kind that has one. */
  abstract require(vendorId: string, kinds: readonly string[]): Promise<void>;
}

/** The "acceptance required" flag in the session response: true when a newer published version of a required vendor document is not yet accepted. */
export abstract class TermsSessionFlag {
  abstract acceptanceRequired(vendorId: string): Promise<boolean>;
}
