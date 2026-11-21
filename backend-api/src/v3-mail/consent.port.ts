/**
 * Whether the enquiry consent text has been published by counsel (Amendment 10 Part L3 and Amendment 12 Q6). Held enquiries are stored only while the SUPER_ADMIN switch is on AND this says yes.
 * The policy store (a later slice) binds the real answer; until then the binding says no, so holding stays off even if the switch is turned on.
 */
export abstract class ConsentGate { abstract enquiryConsentPublished(): Promise<boolean> }
export class NoConsentYet extends ConsentGate { async enquiryConsentPublished(): Promise<boolean> { return false; } }
export class FakeConsent extends ConsentGate { published = false; async enquiryConsentPublished(): Promise<boolean> { return this.published; } }
