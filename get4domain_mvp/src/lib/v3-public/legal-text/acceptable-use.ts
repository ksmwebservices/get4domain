import type { LegalDocDef } from '../legal-meta';

/** Acceptable Use policy. Plain-language DRAFT for review. Makes no professional claim; it is a list of rules for users. */
export const ACCEPTABLE_USE: LegalDocDef = {
  path: '/acceptable-use',
  title: 'Acceptable Use Policy',
  metaTitle: 'Acceptable Use Policy',
  metaDescription: 'The rules for what you may and may not do on Get4Domain: content, listings, messages, security and the partner programme, and what happens if the rules are broken.',
  intro: 'This policy sets the rules for using Get4Domain, which is operated by KSM QUANTUM TECHNOLOGIES. It applies to everything you publish and do on the platform. It is part of our Terms of Service.',
  sections: [
    {
      id: 'general-rule',
      heading: 'The general rule',
      paragraphs: [
        'Use Get4Domain honestly and lawfully. You are responsible for your website, your listing and your account, and for following the laws of India that apply to them.',
      ],
    },
    {
      id: 'content',
      heading: 'What you must not publish',
      paragraphs: ['You must not publish or send anything that:'],
      bullets: [
        'is against the law or helps someone break the law;',
        'copies, uses or shows the work, trademark or personal data of another person without the right to do so;',
        'is false, deceptive or meant to mislead people about your business, your qualifications or what you provide;',
        'is hateful, threatening, harassing, obscene or harmful to children;',
        'contains malware or is meant to damage a computer or a network;',
        'claims that a service is approved, licensed or certified when it is not.',
      ],
    },
    {
      id: 'identity-and-listings',
      heading: 'Identity and listings',
      paragraphs: [
        'You must not pretend to be another person or business. You must claim a directory listing only if you are the owner of that business or are allowed to act for the owner. You must not give false information to claim a listing or to ask for one to be removed.',
      ],
    },
    {
      id: 'messages',
      heading: 'Messages and spam',
      paragraphs: [
        'You must not use Get4Domain to send unwanted bulk messages, to collect personal data in a way the law does not allow, or to contact people who have asked not to be contacted.',
      ],
    },
    {
      id: 'platform',
      heading: 'Protecting the platform',
      paragraphs: ['You must not:'],
      bullets: [
        'try to get into accounts, systems or data that are not yours;',
        'test the security of the platform without our written permission;',
        'overload, copy in bulk or take apart the service;',
        'resell or give access to the service in a way our terms do not allow;',
        'use the payment features for fraud or with payment methods that are not yours.',
      ],
    },
    {
      id: 'partner-programme',
      heading: 'Partner programme',
      paragraphs: [
        'Partners must not create false sign-ups, refer themselves, mislead people about Get4Domain or about the price, or promise a discount, because no discounts exist. Our Partner Programme Terms apply.',
      ],
    },
    {
      id: 'enforcement',
      heading: 'If these rules are broken',
      paragraphs: [
        'We may remove content, hide a listing, limit a feature, suspend or end an account, or report the matter to the authorities where the law requires. Where we reasonably can, we will tell you why. We act as the Information Technology Act and its rules require when we remove content.',
      ],
    },
    {
      id: 'reporting',
      heading: 'Reporting a problem',
      paragraphs: [
        'If you see content or behaviour that breaks these rules, tell us using the details on our Contact page. Say what you saw and where, so that we can look into it.',
      ],
    },
  ],
};
