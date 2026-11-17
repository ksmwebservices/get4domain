import type { LegalDocDef } from '../legal-meta';

/** Cookie notice. Plain-language DRAFT for review. Lists only what the code is known to set; the category list is a question for counsel (docs/v3/LEGAL_REVIEW.md). */
export const COOKIES: LegalDocDef = {
  path: '/cookie-notice',
  title: 'Cookie Notice',
  metaTitle: 'Cookie Notice',
  metaDescription: 'What cookies Get4Domain sets, what each is for, what the payment gateway sets, and how to control cookies in your browser.',
  intro: 'This notice explains the cookies used on the Get4Domain website, which is operated by KSM QUANTUM TECHNOLOGIES. It should be read with our Privacy Policy.',
  sections: [
    {
      id: 'what-cookies-are',
      heading: 'What cookies are',
      paragraphs: [
        'A cookie is a small text file that a website stores in your browser. It lets the website remember something between pages or visits.',
      ],
    },
    {
      id: 'cookies-we-set',
      heading: 'Cookies we set',
      paragraphs: ['We set cookies only for what the service needs:'],
      bullets: [
        'Sign-in and security: where the service uses them, cookies that keep you signed in to your account and help us protect it.',
        'Referral: if you arrive through a partner link, we set a first-party cookie that holds the partner referral code and nothing else. It is used so that your sign-up can be credited to that partner. It is not readable by scripts on the page.',
      ],
    },
    {
      id: 'directory',
      heading: 'The directory',
      paragraphs: [
        'Counting visits to directory pages and clicks to business websites does not set a cookie and does not record personal details.',
      ],
    },
    {
      id: 'third-parties',
      heading: 'Third parties',
      paragraphs: [
        'When you pay, the payment gateway, Razorpay or Cashfree, may set its own cookies on its own pages. We do not control them. Please read the gateway privacy terms.',
      ],
    },
    {
      id: 'control',
      heading: 'Your choices',
      paragraphs: [
        'You can delete cookies or block them in your browser settings. If you block the cookies that sign-in and security need, parts of the service may not work.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this notice',
      paragraphs: [
        'If we start to use other kinds of cookies, we will update this notice before we do. The version and effective date at the top show which text applies.',
      ],
    },
    {
      id: 'questions',
      heading: 'Questions',
      paragraphs: ['For questions about cookies, please use the details on our Contact page.'],
    },
  ],
};
