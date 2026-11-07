import { PayeeVerdict } from './core/trust-core';

/**
 * The seams other modules use to reach trust and safety. They are abstract classes with no imports from those modules, so the site publisher, the public requests service and the payment slice
 * can depend on them without a cycle. Each is optional wherever it is injected: a module built without trust and safety behaves exactly as before.
 */

/** Looks at text that was published or requested and, on a match, raises a PROHIBITED_TEXT alert. It NEVER blocks and NEVER throws: the publish or the request has already happened. */
export abstract class ProhibitedScanPort {
  abstract scan(vendorId: string, source: 'PUBLISH' | 'REQUEST', texts: readonly string[]): Promise<void>;
}

/** Whether a Legal takedown is in force for a vendor. Read fresh on every public request. */
export abstract class TakedownPort {
  abstract activeForVendor(vendorId: string): Promise<boolean>;
}

/**
 * For the payment slice: compares the name on a vendor's UPI handle with the business name and the owner names. A MISMATCH raises an alert and NEVER blocks the vendor. The implementation in
 * this slice is a fake: it compares the name it is GIVEN. The real port will ask the payment provider for the registered payee name.
 */
export abstract class PayeeNameCheckPort {
  abstract check(vendorId: string, payeeName: string | null | undefined): Promise<PayeeVerdict>;
}
