import type { LegalDocDef } from '../legal-meta';

/** Partner (referral) Programme Terms. Plain-language DRAFT for review. The slabs, the TDS rate, the payout dates and the partner agreement are NOT decided here: the text says so in general terms. */
export const PARTNER: LegalDocDef = {
  path: '/partner-terms',
  title: 'Partner Programme Terms',
  metaTitle: 'Partner Programme Terms',
  metaDescription: 'The terms of the Get4Domain partner (referral) programme: independent partners, commission slabs, how a business counts, monthly payouts and tax.',
  intro: 'These terms apply to partners who refer businesses to Get4Domain. Get4Domain is operated by KSM QUANTUM TECHNOLOGIES. They are read together with our Terms of Service, Acceptable Use policy and Privacy Policy.',
  sections: [
    {
      id: 'who-this-covers',
      heading: 'Who these terms cover',
      paragraphs: [
        'A partner is a person or business that KSM QUANTUM TECHNOLOGIES has accepted into the Get4Domain referral programme and that has been given a referral code or link. By taking part, you accept these terms.',
      ],
    },
    {
      id: 'independent-partners',
      heading: 'Partners are independent',
      paragraphs: [
        'A partner is independent. A partner is not an employee, agent or representative of KSM QUANTUM TECHNOLOGIES and cannot make promises or sign anything on our behalf.',
        'A partner decides how to carry out their own work and is responsible for their own costs, licences and taxes.',
      ],
    },
    {
      id: 'referring-businesses',
      heading: 'Referring businesses',
      paragraphs: [
        'A partner refers a business by sharing the partner referral link or code. When a business registers through the link, our system records the referral code.',
        'A partner must describe Get4Domain honestly. A partner must not make false claims about Get4Domain, its features or its price.',
      ],
    },
    {
      id: 'no-discounts',
      heading: 'No discounts to businesses',
      paragraphs: [
        'No discounts, coupons or offers exist. A partner must not promise or imply a discount, a lower price or any special deal. Using a referral link does not change the price a business pays.',
      ],
    },
    {
      id: 'when-a-business-counts',
      heading: 'When a business counts',
      paragraphs: [
        'A business counts for a partner once, on its first successful paid plan payment. A free site, a Free site or a registration alone does not count.',
        'A payment counts only after the payment gateway confirms it. A payment that fails, is cancelled or is held for review does not count until it is confirmed.',
        'Each business counts for one partner only. Our records decide which partner a business is linked to.',
      ],
    },
    {
      id: 'commission',
      heading: 'Commission',
      paragraphs: [
        'Commission is paid by slabs. The administrator of Get4Domain sets the slabs and may change them for the future. The slab that applies to a partner is made known to the partner.',
        'Commission is worked out as the slabs set. We may hold back or reverse commission that relates to a payment that is later refunded, reversed or found not to be valid.',
      ],
    },
    {
      id: 'payouts-and-tax',
      heading: 'Payouts and tax',
      paragraphs: [
        'Commission is paid out monthly, to the account the partner has given us. A partner must keep those details correct and must provide a Permanent Account Number (PAN). We may ask for other tax and identity details before a payout, and we may hold a payout until we have them.',
        'Tax is deducted at source as the law requires, at the rate the company applies. The partner is responsible for any other tax on their income. We may give the partner a statement of the tax deducted.',
      ],
    },
    {
      id: 'privacy',
      heading: 'Privacy of businesses',
      paragraphs: [
        'The partner programme does not show a partner the contact details of the businesses they refer. A partner must not try to get those details from Get4Domain or collect them in a way that breaks the law or our Privacy Policy.',
        'We handle the personal data of partners as our Privacy Policy describes.',
      ],
    },
    {
      id: 'conduct',
      heading: 'Conduct',
      paragraphs: [
        'A partner must follow our Acceptable Use policy. A partner must not refer themselves, create false sign-ups, pay or trick people into registering, or use spam or misleading advertising.',
      ],
    },
    {
      id: 'ending',
      heading: 'Ending the arrangement',
      paragraphs: [
        'A partner may stop at any time by telling us. We may end a partner arrangement or switch off a referral code if a partner breaks these terms, if the law requires it, or if we end the programme.',
        'Commission that was validly earned and is due before the arrangement ends is paid in the normal way, after the checks in these terms. A partner who has broken these terms may lose commission that is not yet paid.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      paragraphs: [
        'We may change these terms. The version and effective date at the top of this page show which text applies. For a change that matters to partners, we will tell them through their account or by email.',
      ],
    },
    {
      id: 'laws-and-courts',
      heading: 'Governing law and courts',
      paragraphs: [
        'These terms are governed by the laws of India. The courts at Chennai, Tamil Nadu have exclusive jurisdiction over any dispute about them.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      paragraphs: ['For a question about the partner programme, please use the details on our Contact page.'],
    },
  ],
};
