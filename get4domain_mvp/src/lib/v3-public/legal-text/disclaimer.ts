import type { LegalDocDef } from '../legal-meta';

/** Disclaimer. Plain-language DRAFT for review by a lawyer in India. No numbers, no time words, no professional claims. */
export const DISCLAIMER: LegalDocDef = {
  path: '/disclaimer',
  title: 'Disclaimer',
  metaTitle: 'Disclaimer',
  metaDescription: 'What Get4Domain is and is not: information only, third-party services, and the content of businesses on the platform.',
  intro: 'This page explains the limits of what this website and the Get4Domain service say and do. Please read it with our Terms of Service.',
  sections: [
    {
      id: 'about-this-website',
      heading: 'About this website',
      paragraphs: [
        'Get4Domain is a software-as-a-service platform for small businesses. It is operated by KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India.',
        'The pages of this website are general information about the service. They are not an offer made to any particular person and they do not form a contract by themselves.',
      ],
    },
    {
      id: 'no-professional-advice',
      heading: 'No professional advice',
      paragraphs: [
        'Nothing on this website is professional, medical, legal, tax or financial advice. Please speak to a qualified professional about your own situation.',
        'Businesses that use Get4Domain decide for themselves what they publish and what they do. We do not check their work or their qualifications.',
      ],
    },
    {
      id: 'content-of-businesses',
      heading: 'Content of businesses',
      paragraphs: [
        'Websites and listings that businesses publish through Get4Domain are the content of those businesses. The business is responsible for it. Appearing on Get4Domain does not mean that we recommend, endorse or have verified a business or what it says.',
        'The business directory shows information about businesses. A listing is not a statement by Get4Domain that the information is complete or correct.',
      ],
    },
    {
      id: 'third-party-services',
      heading: 'Third-party services',
      paragraphs: [
        'We rely on other companies for some parts of the service, for example payment gateways, hosting, email delivery and domain registration. Their services are governed by their own terms. We are not responsible for a failure that is caused by a third party outside our control.',
        'Links on this website to other websites are for convenience. We do not control those websites and are not responsible for them.',
      ],
    },
    {
      id: 'service-availability',
      heading: 'Availability of the service',
      paragraphs: [
        'We work to keep the service running, but we do not promise that it will always be available or free of errors. We may change, pause or improve parts of the service. We make no service-level promise unless it is agreed with you in writing.',
      ],
    },
    {
      id: 'limit-of-responsibility',
      heading: 'Limit of responsibility',
      paragraphs: [
        'To the extent the law allows, KSM QUANTUM TECHNOLOGIES is not responsible for loss that comes from using this website or the service in a way that is not intended, from the content of a business, or from events outside our reasonable control.',
        'Nothing in this page takes away any right you have under the law that cannot be taken away by agreement, including your rights as a consumer.',
      ],
    },
    {
      id: 'governing-law',
      heading: 'Governing law',
      paragraphs: [
        'This page is governed by the laws of India. The courts at Chennai, Tamil Nadu have exclusive jurisdiction over any dispute about it.',
      ],
    },
    {
      id: 'questions',
      heading: 'Questions',
      paragraphs: ['If you have a question about this page, please use the details on our Contact page.'],
    },
  ],
};
