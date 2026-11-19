/**
 * The words of the growth pages: the /growth page, the home sections, the footer column and the pricing rows (the service names and labels are in growth-config.ts).
 * Same copy rules as site-strings.ts, tested in __tests__/growth.test.ts and __tests__/p6.test.ts: "enquiries" never "leads"; no free trial wording; no number, price, ranking,
 * traffic or enquiry promise; "we set up and manage", never "you will rank". The one allowed time phrase is "monthly or yearly allowance" (an allowance by plan, no number).
 * No "soon" label of any kind and no competitor name (P6).
 */
export const GROWTH = {
  nav: 'Growth',
  metaTitle: 'Pro plan: promotion and enquiries',
  metaDescription: 'A Pro plan is a business website on your subdomain and a business web app that captures enquiries, with promotion run by the Get4Domain team.',
  h1: 'Get found and get enquiries',
  lead: 'A Pro plan is not only a website and a business app. It also includes promotion that our team sets up and manages, through our directory pages and your own Get4Domain subdomain, with enquiries captured in your business app.',
  honest: 'We set up and manage the work. We cannot promise a position in search results, a number of visitors or a number of enquiries, and we do not.',

  /** P6.5: how a business gets found, in four steps. */
  findHeading: 'How you get found',
  find: [
    { title: 'Directory pages by category and area', body: 'Pages such as plumbers in Vadapalani list the businesses of an area. Your listing is on the page for your category and your area.' },
    { title: 'Your Get4Domain subdomain', body: 'Your own business site on its own address, for example plumberkumar.get4domain.com. People who find you can open it and send an enquiry.' },
    { title: 'Campaigns run by Get4Domain', body: 'Our team promotes the directory pages and your subdomain, and runs campaigns to your own customers who agreed to receive them.' },
    { title: 'Enquiries captured in your business app', body: 'Each enquiry arrives as a record in your business app, where you follow it up.' },
  ],

  /** P6.5: the business tools section (the tools themselves are the "tools" group of growth-config.ts). */
  toolsHeading: 'Business tools',
  toolsLead: 'The tools you use yourself in your business app. Only tools that work today are listed.',

  modelHeading: 'Where promotion runs',
  model: [
    { title: 'Directory pages', body: 'Pages such as plumbers in Vadapalani list the businesses of an area. We target them with SEO, AEO and GEO, and with search-engine and Meta promotion. Your listing is on them.' },
    { title: 'Your subdomain site', body: 'Your own site, for example plumberkumar.get4domain.com. From time to time we promote it directly with a presentation. On the annual plan our team also makes reels and a poster, promoted to your subdomain only.' },
    { title: 'Not on your own domain', body: 'Promotion does not run on a domain name of your own. SEO, social media and a communication hub for your own domain are the custom domain pack, an add-on.' },
  ],
  allowanceNote: 'Everything run for you comes with a monthly or yearly allowance by plan. Allowances are shown in your business app.',

  howHeading: 'How it works',
  how: [
    { title: 'You request', body: 'Choose what you want from your business app. Tell us about your business and your customers.' },
    { title: 'Our team delivers', body: 'Our team does the work for you, as set by the allowance of your plan.' },
    { title: 'You track it in the app', body: 'See what was requested, what is done and what is being worked on, in your business app.' },
  ],

  statusHeading: 'What the labels mean',
  statusNotes: [
    { status: 'pro', body: 'This comes with every Pro plan. Work run for you has a monthly or yearly allowance by plan.' },
    { status: 'included', body: 'This is on the Free plan and on the Pro plans.' },
    { status: 'addon', body: 'A separate pack for your own domain name. Ask us and we will tell you the price.' },
  ],

  ecommerceOnly: 'Ecommerce plan only',

  /** P6.4(c): the custom domain pack, with a link to the contact page. */
  addonHeading: 'Custom domain pack',
  addonBody: 'If you connect a domain name of your own, the Get4Domain promotion does not run on it. The custom domain pack adds SEO, social media and a communication hub on your own domain. It is an add-on pack and the price is on request.',
  addonLink: 'Ask about the custom domain pack',
  addonHref: '/contact',

  freeHeading: 'On the Free plan',
  freeBody: 'The Free plan is a site with limited access, to get started. It has a directory listing. The work run for you and the business tools stay locked until you move to a Pro plan.',

  ctaHeading: 'Start free, and move to a Pro plan when you are ready',
  ctaBody: 'Register with a free site first. Choose a Pro plan when you want the business tools and the work run for you.',
  ctaStart: 'Start free',
  ctaPlans: 'See Pro plans',

  faqHeading: 'Questions about what a Pro plan includes',
  faq: [
    { q: 'What does Get4Domain promote for me?', a: 'Our team promotes your business on the directory pages that list your category in your area and on your own Get4Domain subdomain, through search engines and Meta, and runs campaigns by SMS, e-mail and WhatsApp to your own customers who agreed to receive them. Reels, posters, posts and blogs are made by our team. How much you get depends on your plan. We cannot promise a position in search results or a number of enquiries.' },
    { q: 'What is the custom domain pack?', a: 'If you connect a domain name of your own, the promotion we run does not run on it. The custom domain pack is an add-on that brings SEO, social media and a communication hub to your own domain. It is not part of a Pro plan and the price is on request, so ask us through the contact page.' },
    { q: 'Do you promise a position in search results?', a: 'No. Nobody can promise that. We set up and manage the work, and what a search engine shows is always its own decision.' },
    { q: 'Do I need to know about SEO or content?', a: 'No. Our team does the setup and the writing. You check the result and keep control of your own business details.' },
    { q: 'How much do I get of each service?', a: 'It depends on your plan, with a monthly or yearly allowance by plan. Reels and a poster are on the annual plan.' },
    { q: 'Is the Merchant profile for every plan?', a: 'No. The Google Merchant profile is for the Ecommerce plan only.' },
  ],

  /** The home sections. */
  homeHeading: 'Run for you by Get4Domain',
  homeLead: 'On a Pro plan our team sets up and manages promotion, through the directory pages and your own subdomain site, with a monthly or yearly allowance by plan.',
  homeMore: 'See everything a Pro plan includes',

  /** The footer column. */
  footerHeading: 'In a Pro plan',
  footerPlans: 'Plans',
  footerAll: 'Everything a Pro plan includes',
  footerCompare: 'Compare Free and Pro plans',
  footerFree: 'The Free plan',
  footerSeePlans: 'Pro plans',

  /** Pricing comparison. */
  compareGrowthHeading: 'Run for you, business tools and the custom domain pack',
  compareLocked: 'Locked',
  compareIncludedFree: 'Included',
  compareEcommerceNote: 'Ecommerce plan only.',
  promotionNote: 'Promotion applies to the Get4Domain subdomain site and to the directory pages. It does not run on your own domain name: the custom domain pack is an add-on, price on request. How much you get of each service is an allowance by plan, and nothing here promises a position in search results or a number of enquiries.',
} as const;

/** The anchor of a group section on the growth page. */
export const growthAnchor = (group: string): string => `growth-${group}`;
