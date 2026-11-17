import type { LegalDocDef } from '../legal-meta';

/** Directory and Listing Terms. Plain-language DRAFT for review. Built only from the frozen directory rules; no ranking, rating or contact-data claim. */
export const LISTING: LegalDocDef = {
  path: '/directory-listing-terms',
  title: 'Directory and Listing Terms',
  metaTitle: 'Directory and Listing Terms',
  metaDescription: 'How the Get4Domain business directory works: what a listing shows, how an owner claims it, how to ask for a correction or removal, and what we do not do.',
  intro: 'These terms explain the Get4Domain business directory, which is operated by KSM QUANTUM TECHNOLOGIES. They are read together with our Terms of Service and Privacy Policy.',
  sections: [
    {
      id: 'what-the-directory-is',
      heading: 'What the directory is',
      paragraphs: [
        'The directory lists businesses so that people can find them and visit their websites. A listing can exist before the owner has claimed it.',
        'Being listed does not mean that Get4Domain recommends or has checked a business. Please read our Disclaimer.',
      ],
    },
    {
      id: 'what-a-listing-shows',
      heading: 'What a listing shows',
      paragraphs: [
        'A listing shows information about the business, such as its name, category and location, and one way to visit its website. The visit link goes through Get4Domain, which counts the visit without recording personal details.',
        'A listing does not show a phone number, an email address or a messaging link. The directory does not pass on enquiries to a business.',
        'Get4Domain does not rate or review businesses, and the directory does not rank them by any claim of quality.',
      ],
    },
    {
      id: 'claiming-a-listing',
      heading: 'Claiming a listing',
      paragraphs: [
        'The owner of a business, or a person allowed to act for the owner, may claim its listing. To claim, you confirm control of the contact we hold for that business. We send a code to that contact. We never send a code to an address typed into the page.',
        'You must give true information when you claim. If you are not the owner and you claim, or you give false details, we may cancel the claim and take action under our Acceptable Use policy.',
        'After a claim is confirmed, you can set up your account and your website, and the listing can show the website you publish.',
      ],
    },
    {
      id: 'owner-responsibilities',
      heading: 'What an owner is responsible for',
      paragraphs: [
        'An owner who claims a listing is responsible for the information on it and on the linked website. It must be true, lawful and not misleading, and it must follow our Acceptable Use policy.',
      ],
    },
    {
      id: 'corrections-and-removal',
      heading: 'Corrections and removal',
      paragraphs: [
        'A business can ask us to correct or remove its listing. Use the details on our Contact page and name the business and the listing. We confirm the request through the contact we hold for the business before we act.',
        'We may also correct or remove a listing ourselves, for example if the information is wrong, the business no longer exists, or the law requires it.',
      ],
    },
    {
      id: 'free-sites',
      heading: 'Free sites',
      paragraphs: [
        'A Free site is informational. It lists the business and does not carry the features of a paid plan.',
      ],
    },
    {
      id: 'accuracy',
      heading: 'Accuracy',
      paragraphs: [
        'We take care with the directory, but we do not guarantee that a listing is complete or up to date. Please check details with the business itself.',
      ],
    },
    {
      id: 'data',
      heading: 'Personal data',
      paragraphs: [
        'Our Privacy Policy explains how we handle personal data in the directory.',
      ],
    },
    {
      id: 'laws-and-courts',
      heading: 'Governing law and courts',
      paragraphs: [
        'These terms are governed by the laws of India. The courts at Chennai, Tamil Nadu have exclusive jurisdiction over any dispute about them.',
      ],
    },
  ],
};
