import { TermsConsentGate } from '../src/terms/terms-consent.gate';
import { ConsentGate } from '../src/v3-mail/consent.port';

/** Held enquiries need counsel's Enquiry Consent text to be PUBLISHED. The gate reads the terms store, whose publish step refuses placeholders. */
describe('the enquiry consent gate', () => {
  const gate = (published: unknown) => new TermsConsentGate({ latestPublished: async (k: string) => (k === 'ENQUIRY_CONSENT' ? published : null) } as never);
  it('says no until a version of the Enquiry Consent text is published, then yes', async () => {
    expect(await gate(null).enquiryConsentPublished()).toBe(false); expect(await gate({ id: 'd1', status: 'PUBLISHED' }).enquiryConsentPublished()).toBe(true);
  });
  it('asks about the enquiry consent kind only (another published document does not count)', async () => {
    const asked: string[] = []; const g = new TermsConsentGate({ latestPublished: async (k: string) => { asked.push(k); return k === 'PRIVACY' ? { id: 'x' } : null; } } as never);
    expect(await g.enquiryConsentPublished()).toBe(false); expect(asked).toEqual(['ENQUIRY_CONSENT']);
  });
  it('it is a ConsentGate, so the inbox can take it', () => { expect(gate(null)).toBeInstanceOf(ConsentGate); });
});
