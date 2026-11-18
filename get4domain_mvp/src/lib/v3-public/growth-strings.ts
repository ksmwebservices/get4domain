/**
 * The words of the growth pages: the /growth page, the home section, the footer column and the pricing rows (the service names and status labels are in growth-config.ts).
 * Same copy rules as site-strings.ts, tested in __tests__/growth.test.ts: "enquiries" never "leads"; no free trial wording; no number, price, ranking, traffic or enquiry promise;
 * "we set up and manage", never "you will rank". The one allowed time phrase is "monthly or yearly allowance" (an allowance by plan, no number).
 */
export const GROWTH = {
  nav: 'Growth',
  metaTitle: 'Growth services: get found and get enquiries',
  metaDescription: 'A paid plan is a website, the business tools and promotion work done by our team, through the directory pages and your own subdomain site.',
  h1: 'Get found and get enquiries',
  lead: 'A paid plan is not only a website and a business app. It also includes promotion that our team sets up and manages, through our directory pages and your own Get4Domain subdomain site.',
  honest: 'We set up and manage the work. We cannot promise a position in search results, a number of visitors or a number of enquiries, and we do not.',

  modelHeading: 'Where promotion runs',
  model: [
    { title: 'Directory pages', body: 'Pages such as plumbers in Vadapalani list the businesses of an area. We target them with SEO, AEO and GEO, and with Google and Meta ads that Get4Domain runs (launching soon). Your listing is on them.' },
    { title: 'Your subdomain site', body: 'Your own site, for example plumberkumar.get4domain.com. From time to time we promote it directly with a presentation. On the annual plan our team also makes reels and a poster, promoted to your subdomain only.' },
    { title: 'Not on a custom domain', body: 'Promotion does not run on a custom domain. SEO and paid ads for a custom domain are an add-on pack.' },
  ],
  allowanceNote: 'How much of each service you get depends on your plan, with a monthly or yearly allowance by plan. Allowances are shown in your business app.',

  howHeading: 'How it works',
  how: [
    { title: 'You request', body: 'Choose what you want from your business app. Tell us about your business and your customers.' },
    { title: 'Our team delivers', body: 'Our team does the work for you, as set by the allowance of your plan.' },
    { title: 'You track it in the app', body: 'See what was requested, what is done and what is being worked on, in your business app.' },
  ],

  statusHeading: 'What the labels mean',
  statusNotes: [
    { status: 'included', body: 'This comes with the plan.' },
    { status: 'team', body: 'Our team does this work. You do not need the skills.' },
    { status: 'allowance', body: 'Our team does this work, with a monthly or yearly allowance that depends on your plan.' },
    { status: 'soon', body: 'Not live yet. It will appear in your business app when it is ready.' },
    { status: 'addon', body: 'Sold as a separate pack. Price not set yet.' },
  ],

  ecommerceOnly: 'Ecommerce plan only',
  addonPrice: 'Price not set yet',

  freeHeading: 'On the Free plan',
  freeBody: 'The Free plan is a site with limited access, to get started. It has a directory listing. The promotion services stay locked until you move to a paid plan.',

  ctaHeading: 'Start free, and move to a paid plan when you are ready',
  ctaBody: 'Register with a free site first. Choose a paid plan when you want the website tools and the growth services.',
  ctaStart: 'Start free',
  ctaPlans: 'See plans',

  faqHeading: 'Questions about growth services',
  faq: [
    { q: 'Do you promise a position in search results?', a: 'No. Nobody can promise that. We set up and manage the work, and what a search engine shows is always its own decision.' },
    { q: 'Where is my business promoted?', a: 'On the Get4Domain directory pages that list your category in your area, and on your own Get4Domain subdomain site. It is not promoted on a custom domain.' },
    { q: 'Can you promote my own domain name?', a: 'SEO and paid ads for a custom domain are an add-on pack. Price not set yet.' },
    { q: 'Do I need to know about SEO or content?', a: 'No. Our team does the setup and the writing. You check the result and keep control of your own business details.' },
    { q: 'Are the campaign services and ads live?', a: 'Not yet. Google and Meta ads for the directory pages, e-mail, SMS and WhatsApp campaigns and social posting to your accounts are launching soon, and they are marked that way everywhere.' },
    { q: 'How much do I get of each service?', a: 'It depends on your plan, with a monthly or yearly allowance by plan. Reels and a poster are on the annual plan.' },
    { q: 'Is the Merchant listing for every plan?', a: 'No. The Google Merchant profile listing is for the Ecommerce plan only.' },
  ],

  /** The home section. */
  homeHeading: 'Get found and get enquiries',
  homeLead: 'On a paid plan our team also sets up and manages promotion, through the directory pages and your own subdomain site. Here is what is in it and what is launching soon.',
  homeMore: 'See all growth services',
  heroLine: 'Website, business tools and promotion in one plan.',

  /** The footer column. */
  footerHeading: 'Growth services',
  footerPlans: 'Plans',
  footerAll: 'All growth services',
  footerCompare: 'Compare Free and paid',
  footerFree: 'The Free plan',
  footerSeePlans: 'Pro plans',

  /** Pricing comparison. */
  compareGrowthHeading: 'Growth and promotion',
  compareLocked: 'Locked',
  compareIncludedFree: 'Included',
  compareEcommerceNote: 'Ecommerce plan only.',
  promotionNote: 'Promotion applies to the Get4Domain subdomain site and to the directory pages. It does not run on a custom domain: SEO and paid ads for a custom domain are an add-on pack, price not set yet. How much you get of each service is an allowance by plan, and nothing here promises a position in search results or a number of enquiries.',
} as const;

/** The anchor of a group section on the growth page. */
export const growthAnchor = (group: string): string => `growth-${group}`;
