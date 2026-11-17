import type { LegalSection } from './legal-meta';

/**
 * The words of the About and Contact pages (dispatch D1, L3). Same rules as the policy text: no digits, no time words, no discount or offer wording,
 * no ranking claim, nothing invented about the company (no history, numbers or team). The firm's details come from the firm facts module, not from here.
 */
export const ABOUT_STRINGS = {
  path: '/about',
  metaTitle: 'About us',
  metaDescription: 'Get4Domain is a software-as-a-service platform for small businesses, operated by KSM QUANTUM TECHNOLOGIES in Chennai, Tamil Nadu, India.',
  h1: 'About Get4Domain',
  intro: 'Get4Domain is a software-as-a-service platform for small businesses. A business gets a website on its own subdomain and the tools to run it.',
  sections: [
    {
      id: 'what-you-can-do',
      heading: 'What a business can do on Get4Domain',
      bullets: [
        'Start with a free trial site.',
        'Move to a paid plan, billed quarterly, half-yearly or annually. Prices are shown without GST.',
        'Use the wallet, which holds prepaid platform credit.',
        'Claim its listing in the Get4Domain business directory.',
        'Run its website on its own subdomain.',
      ],
    },
    {
      id: 'how-you-pay',
      heading: 'How payment works',
      paragraphs: [
        'Businesses pay for plans only through an online payment gateway. GST is added at checkout, and an invoice is issued after a successful payment.',
      ],
    },
    {
      id: 'partners',
      heading: 'Partners',
      paragraphs: [
        'Partners can refer businesses to Get4Domain through the partner programme. The programme has its own terms.',
      ],
    },
    {
      id: 'who-runs-it',
      heading: 'Who runs Get4Domain',
      paragraphs: [
        'Get4Domain is operated by KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India.',
      ],
    },
  ] as readonly LegalSection[],
  policiesHeading: 'Our policies',
  policiesIntro: 'Please read the terms and policies that apply to Get4Domain.',
  contactLink: 'Contact us',
} as const;

export const CONTACT_STRINGS = {
  path: '/contact',
  metaTitle: 'Contact',
  metaDescription: 'How to reach Get4Domain, operated by KSM QUANTUM TECHNOLOGIES in Chennai, Tamil Nadu, India: company details, support, payments and data requests.',
  h1: 'Contact',
  intro: 'This page tells you how to reach Get4Domain, which is operated by KSM QUANTUM TECHNOLOGIES.',
  helpHeading: 'Help',
  accountHelp: 'For help with your account, sign in to your business app and use the support section there.',
  otherHelpWithDetails: 'For anything else, use the support details below.',
  otherHelpNoDetails: 'For anything else, write to us at our registered office below.',
  detailsHeading: 'Company details',
  paymentsHeading: 'Payments and refunds',
  paymentsBody: 'For a question about a payment, an invoice or a refund, give your account email and the payment reference.',
  requestsHeading: 'Data requests, listing corrections and removals',
  requestsBody: 'To ask about your personal data, to correct or remove a directory listing, or to report content that breaks our rules, tell us what you need. We confirm a request about a listing through the contact we hold for the business.',
  grievanceHeading: 'Grievance officer',
  grievanceBody: 'If you have a complaint about how we handle your personal data or about the service, you can write to our grievance officer.',
  grievanceLabels: { name: 'Name', email: 'Email', phone: 'Phone' },
} as const;
