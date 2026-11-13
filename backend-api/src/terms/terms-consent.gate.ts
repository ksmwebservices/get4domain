import { Injectable } from '@nestjs/common';
import { ConsentGate } from '../v3-mail/consent.port';
import { TermsStore } from './terms.store';

/**
 * Whether counsel's Enquiry Consent text is PUBLISHED (Amendment 10 Part L3). The terms store refuses to publish a placeholder or a body with unfilled square-bracket placeholders, so a published
 * version is, by construction, text a person approved. Held enquiries stay off until this says yes.
 */
@Injectable()
export class TermsConsentGate extends ConsentGate {
  constructor(private readonly store: TermsStore) { super(); }
  async enquiryConsentPublished(): Promise<boolean> { return (await this.store.latestPublished('ENQUIRY_CONSENT')) !== null; }
}
