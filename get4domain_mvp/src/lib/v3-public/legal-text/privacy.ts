import type { LegalDocDef } from '../legal-meta';

/** Privacy Policy. Plain-language DRAFT for review by a lawyer in India. Retention follows the OWNER DEFAULT of dispatch D2 (kept while the account is active; deleted or anonymised after closing, except records the law requires); a lawyer refines it later. */
export const PRIVACY: LegalDocDef = {
  path: '/privacy-policy',
  title: 'Privacy Policy',
  metaTitle: 'Privacy Policy',
  metaDescription: 'What personal data Get4Domain collects, why, who it is shared with, how directory data is handled, cookies, your rights and how to reach us about your data.',
  intro: 'This policy explains how KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India, uses personal data when you use Get4Domain. We decide why and how the data described here is used.',
  sections: [
    {
      id: 'what-we-collect',
      heading: 'What we collect',
      paragraphs: ['We collect only what we need to run the service. Depending on how you use Get4Domain, this can include:'],
      bullets: [
        'Account details: your name, email address, phone number and password (stored in a protected form).',
        'Business details: the name of your business, its category, your site address and the content you put on your website or listing.',
        'Billing records: your plan, billing term, orders, invoices and wallet transactions. Payments are made on the payment gateway, which tells us whether a payment succeeded and gives us a payment reference. We do not receive or store your card, UPI or bank details.',
        'Partner details: a referral code, a Permanent Account Number (PAN) and the details needed to pay commission and deduct tax as the law requires, for partners only.',
        'Messages: what you send us when you ask for help or make a request.',
        'Technical data: your IP address, browser and device information, and basic logs of how the service is used, kept for security and to run the service.',
        'Directory data: information about businesses shown in the directory, described below.',
      ],
    },
    {
      id: 'why-we-use-it',
      heading: 'Why we use it',
      paragraphs: ['We use personal data to:'],
      bullets: [
        'create and run your account, free site and website;',
        'take payment through the payment gateway, issue invoices and keep records the law requires, including under the Central Goods and Services Tax Act;',
        'verify claims on directory listings and handle requests to correct or remove a listing;',
        'pay partner commission and deduct tax where the law requires;',
        'answer your questions and send you messages about your account and the service;',
        'keep the service secure, prevent misuse and fix faults;',
        'meet our legal duties and respond to lawful requests from authorities.',
      ],
    },
    {
      id: 'who-we-share-with',
      heading: 'Who we share it with',
      paragraphs: [
        'We do not sell personal data. We share it only where it is needed to run the service:',
      ],
      bullets: [
        'Payment gateways (Razorpay or Cashfree) to process payments. They have their own privacy terms.',
        'Hosting providers and other service providers that store data or send email for us, under their duties to protect it.',
        'Professional advisers, and authorities where the law requires us to share.',
        'A buyer or successor of our business, if the business changes hands, on the same terms as this policy.',
      ],
    },
    {
      id: 'directory-data',
      heading: 'Directory data',
      paragraphs: [
        'The directory lists businesses. A listing can show the name of a business, its category and location, and a link to visit its website. It does not show a phone number, email address or messaging link, and it does not pass on enquiries.',
        'A listing can exist before the owner has claimed it. When someone claims a listing, we send a code to the contact we hold for that business. We never send it to an address typed into the page.',
        'The owner of a business can ask us to correct or remove its listing. Use the Contact page. We confirm the request through the contact we hold.',
        'Counting visits to directory pages and clicks to business websites does not record personal details and does not set a cookie.',
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies',
      paragraphs: ['Our Cookie notice lists the cookies we set and what they do.'],
    },
    {
      id: 'your-rights',
      heading: 'Your rights',
      paragraphs: [
        'Under the Digital Personal Data Protection Act and its rules as in force, you may have the right to:',
      ],
      bullets: [
        'ask for a summary of the personal data we hold about you and how we use it;',
        'ask us to correct or complete data that is wrong or out of date;',
        'ask us to erase data that we no longer need, subject to records we must keep by law;',
        'withdraw a consent you gave, where we rely on consent;',
        'name another person to act for you if you cannot;',
        'complain about how we handle your data.',
      ],
    },
    {
      id: 'data-requests-and-complaints',
      heading: 'Data requests and complaints',
      paragraphs: [
        'To make a request about your data, or to complain, use the details on our Contact page. Where a grievance officer is named there, you can write to that person. We will confirm who you are before acting on a request, and we will reply as the law requires.',
        'If you are not satisfied with our reply, you may approach the authority that the law provides.',
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep data',
      paragraphs: [
        'We keep your personal data while your account is active. After the account is closed, we delete the data or make it anonymous. The exception is records that the law requires us to keep, such as invoices and tax records. We keep those for as long as the law requires.',
      ],
    },
    {
      id: 'security',
      heading: 'Keeping data safe',
      paragraphs: [
        'We use reasonable safeguards to protect personal data, in line with the Information Technology Act and its rules. No system is completely safe, so we cannot promise that data will never be accessed without permission. If something goes wrong that affects you, we will act as the law requires.',
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      paragraphs: [
        'Get4Domain is for businesses. It is not meant for children, and we do not knowingly collect personal data from a child. If you believe a child has given us personal data, please contact us and we will deal with it.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      paragraphs: [
        'We may update this policy. The version and effective date at the top of this page show which text applies. For a change that matters to you, we will tell you through your account or by email.',
      ],
    },
    {
      id: 'laws-and-courts',
      heading: 'Governing law',
      paragraphs: [
        'This policy is governed by the laws of India. The courts at Chennai, Tamil Nadu have exclusive jurisdiction over any dispute about it.',
      ],
    },
  ],
};
