/**
 * Every word of the marketing pages added in dispatch G3: product pages, partner programme, guides, the category pages, and the extra home and navigation text.
 * Same rules as site-strings.ts (tested in __tests__/site-copy-rules.test.ts over this module too): never workspace, BOS or LeadSpace; "enquiries" not "leads"; no timeframes
 * (quarterly, half-yearly and annual are billing terms and allowed); no written price; no discount, offer, coupon or deal wording; no ranking claim; no counts, ratings or reviews.
 * Honest copy: no result is promised, and nothing is said about a feature beyond what a business does with it.
 */
export interface Faq { q: string; a: string }
export interface ProductPage {
  slug: string; name: string; metaTitle: string; metaDescription: string; h1: string; lead: string;
  gives: readonly string[]; steps: readonly { title: string; body: string }[]; plan: string; faq: readonly Faq[]; related: readonly string[];
}

const PLAN_NOTE = 'Free sites are informational. Buttons, forms and contact links on your site need a paid plan. Prices are shown without GST.';

export const MARKETING = {
  nav: { product: 'Product', guides: 'Guides', partners: 'Partners' },

  footer: {
    productHeading: 'Product',
    learnHeading: 'Learn',
    companyHeading: 'Company',
    industriesLink: 'Industries',
    pricingLink: 'Pricing',
    howLink: 'How it works',
    guidesLink: 'Guides',
    partnersLink: 'Partner programme',
    directoryLink: 'Directory',
  },

  home: {
    audienceHeading: 'Who it is for',
    audienceBody: 'Get4Domain is for businesses that want a website of their own and the tools to run it: service providers, shops, practices, studios, schools and many other kinds of business. Each business area comes with starter content and working areas that suit it.',
    audienceLink: 'Browse industries',
    tracksHeading: 'Three business tracks',
    tracksIntro: 'Every paid plan includes your website, the business tools and the promotion work done by our team. Choose the track that fits how your business works. You can start with a free site before you choose.',
    tracks: [
      { name: 'Handyman', body: 'For one-person service businesses.' },
      { name: 'Professional', body: 'For firms and practices.' },
      { name: 'Ecommerce', body: 'For businesses that sell online.' },
    ],
    tracksLink: 'Compare plans',
    productHeading: 'What you get',
    productIntro: 'One address for your business online, and the tools behind it.',
    directoryHeading: 'Find businesses in the directory',
    directoryBody: 'Browse businesses by city and category. Each listing links to the business site.',
    partnersHeading: 'Partner programme',
    partnersBody: 'Introduce businesses to Get4Domain with your own partner link. See how the programme works.',
    partnersLink: 'About the partner programme',
    guidesHeading: 'Guides',
    guidesBody: 'Plain explanations of what a business website needs and how to get the most from yours.',
    guidesLink: 'Read the guides',
    ctaHeading: 'Start with a free site',
    ctaBody: 'Register, check your site, and move to a paid plan when you want the main features.',
    faq: [
      { q: 'What is Get4Domain?', a: 'Get4Domain gives a business a website on its own subdomain, starter content for its business area, and a business app to run it. You can start with a free site.' },
      { q: 'Who is it for?', a: 'Any business that wants a website of its own: service providers, shops, practices, studios, schools and more. The industries page lists the business areas.' },
      { q: 'How do I start?', a: 'Register with your business name, category and site address. Your free site goes live right away. When you want the main features, choose a paid plan.' },
      { q: 'Is there a directory?', a: 'Yes. Businesses are listed by city and category, and each listing has a Visit site link to the business site.' },
    ] as readonly Faq[],
  },

  how: {
    whoHeading: 'Who it is for',
    whoBody: 'Any business that wants a website of its own and the tools to run it. Pick your industry and category when you register and your site starts with content that suits your business area.',
    stepsHeading: 'The three steps',
    afterHeading: 'After you register',
    after: [
      'Edit your site content in your business app: text, photos, pages and contact details.',
      'Choose a theme that suits your business area.',
      'Move to a paid plan to turn on buttons, forms, contact links and the main features of your business area.',
      'Connect a domain name of your own on a paid plan.',
    ],
    moreHeading: 'Learn more',
    moreLinks: [
      { label: 'What a business website needs', path: '/guides/what-a-business-website-needs' },
      { label: 'The website product page', path: '/product/website' },
      { label: 'Plans and pricing', path: '/pricing' },
    ],
    faqHeading: 'Common questions',
    faq: [
      { q: 'Do I need technical skills?', a: 'No. You edit your site in your business app.' },
      { q: 'Where does my site live?', a: 'On your own subdomain, which you choose when you register.' },
      { q: 'How do I pay for a plan?', a: 'Payment happens inside your business app, through our payment gateway. This website never takes a payment and never asks for card details.' },
    ] as readonly Faq[],
  },

  industriesHub: {
    lead: 'Pick the business area that matches yours. Each page shows what the area gives your business and the categories inside it.',
    categoriesHeading: 'Categories',
    allCategories: 'All categories',
    guidesLink: 'New to this? Read the guides',
  },

  product: {
    metaTitle: 'Product',
    metaDescription: 'The Get4Domain web app: a website for your business, business tools, enquiry capture, and promotion through our directory pages, SEO keywords and your own subdomain.',
    h1: 'Product',
    lead: 'Get4Domain is a local business directory and search, with a web app for every business: a website, business tools, enquiry capture and promotion. Each part has a page of its own.',
    viewLink: 'Read more',
    crumb: 'Product',
    gives: 'What you get',
    howHeading: 'How it works',
    planHeading: 'On which plan',
    relatedHeading: 'Related',
    faqHeading: 'Common questions',
    ctaHeading: 'Start with a free site',
    ctaPrimary: 'Start free',
    ctaSecondary: 'See pricing',
    hubLink: 'All product pages',
    faq: [
      { q: 'Do I need a paid plan to try Get4Domain?', a: 'No. You register yourself and your free site goes live right away on its own subdomain. Free sites are informational.' },
      { q: 'Where do I manage everything?', a: 'In your business app. You edit your site there and, on a paid plan, use the tools for your business area.' },
    ] as readonly Faq[],
    pages: [
      {
        slug: 'website', name: 'Website', metaTitle: 'Business website on your own subdomain',
        metaDescription: 'A website for your business on its own subdomain, with starter content for your business area. Edit it yourself and choose a theme.',
        h1: 'A website for your business', lead: 'Your site goes live on your own subdomain as soon as you register, with starter content for your business area.',
        gives: ['A site on your own subdomain', 'Starter content written for your business area', 'Editing of text, photos, pages and contact details in your business app', 'A choice of themes that suit your business area', 'Pages that work on phones and larger screens'],
        steps: [
          { title: 'Register', body: 'Enter your business name, choose a category and pick your site address.' },
          { title: 'Check your site', body: 'It is live right away. Change the content to describe your business.' },
          { title: 'Move to a paid plan', body: 'Turn on buttons, forms and contact links when you are ready.' },
        ],
        plan: PLAN_NOTE,
        faq: [
          { q: 'Can I change how my site looks?', a: 'Yes. You can choose a theme that suits your business area in your business app.' },
          { q: 'Can I edit it myself?', a: 'Yes. You edit the content of your site in your business app. No technical skills are needed.' },
        ],
        related: ['search-visibility', 'domains', 'enquiries'],
      },
      {
        slug: 'search-visibility', name: 'Search visibility', metaTitle: 'Search visibility for your business site',
        metaDescription: 'Pages built so that search engines can read them: titles, descriptions, headings, structured data and a sitemap, written for your business.',
        h1: 'Search visibility', lead: 'Your site is built so that search engines can read it. What a search engine shows is always its own decision.',
        gives: ['A title and description for each page', 'Clear headings and readable page structure', 'Structured data that describes your business and your questions and answers', 'A sitemap and a robots file for your site', 'A listing in the directory that links to your site'],
        steps: [
          { title: 'Describe your business', body: 'Fill in your business name, what you do and where you work.' },
          { title: 'Keep content current', body: 'Update your pages when something about your business changes.' },
          { title: 'Share your address', body: 'Use your site address on your cards, messages and profiles so people can find it.' },
        ],
        plan: 'Every site is built the same way. Free plan sites are informational pages. No plan can promise a position in search results, and we do not.',
        faq: [
          { q: 'Will my site appear first in search results?', a: 'No one can promise that, and we do not. A search engine decides what to show and in what order. We build your pages so that they are easy for a search engine to read.' },
          { q: 'Do I need to add anything to my site myself?', a: 'No. The titles, descriptions, structured data and sitemap are produced from the content you write.' },
        ],
        related: ['directory', 'website', 'domains'],
      },
      {
        slug: 'enquiries', name: 'Enquiries', metaTitle: 'Enquiries from your business site',
        metaDescription: 'Let visitors ask about your business from your site, and keep every enquiry in one place in your business app.',
        h1: 'Enquiries', lead: 'On a paid plan, visitors can send an enquiry from your site. You see it in your business app and keep track of the reply.',
        gives: ['An enquiry form on your site', 'Every enquiry in one place in your business app', 'A record of each customer who gets in touch', 'Checks that keep unwanted messages out'],
        steps: [
          { title: 'A visitor asks', body: 'They fill in the form on your site and agree to be contacted about their enquiry.' },
          { title: 'You see it', body: 'The enquiry appears in your business app.' },
          { title: 'You reply', body: 'Answer the customer and note what happened next.' },
        ],
        plan: PLAN_NOTE,
        faq: [
          { q: 'Does a free site have an enquiry form?', a: 'No. Free sites are informational. Forms, buttons and contact links need a paid plan.' },
          { q: 'Who sees the enquiries?', a: 'You and the team members you add to your business app.' },
        ],
        related: ['business-tools', 'website', 'reports'],
      },
      {
        slug: 'directory', name: 'Directory', metaTitle: 'Business directory by city and category',
        metaDescription: 'Browse businesses by city and category, or list yours. Every listing has a Visit site link to the business site.',
        h1: 'Directory', lead: 'A directory of businesses by city and category. Every listing has a Visit site link that takes you to the business site.',
        gives: ['Listings by city and category', 'A page for each business', 'A Visit site link on every listing', 'A way for a business owner to claim a listing'],
        steps: [
          { title: 'Browse', body: 'Choose a city and a category to see the businesses listed there.' },
          { title: 'Open a business page', body: 'Read what the business does and where it works.' },
          { title: 'Visit the site', body: 'Use the Visit site link to go to the business site.' },
        ],
        plan: 'Every registered business can have a listing. Free sites are informational.',
        faq: [
          { q: 'Does the directory show phone numbers or email addresses?', a: 'No. A listing has one action: the Visit site link. Contact details are on the business site, where the plan allows them.' },
          { q: 'How do I claim my listing?', a: 'Open your business page in the directory and choose the claim option. You confirm that you own the business, then set up your account.' },
        ],
        related: ['search-visibility', 'website', 'business-tools'],
      },
      {
        slug: 'reports', name: 'Reports', metaTitle: 'Reports for your business',
        metaDescription: 'See how your site and your enquiries are doing in your business app, so you can decide what to change.',
        h1: 'Reports', lead: 'A view of how your site and your enquiries are doing, in your business app.',
        gives: ['A summary of your site and your enquiries', 'Information to help you decide what to change', 'Reports that follow your business area'],
        steps: [
          { title: 'Use your site', body: 'Visitors browse your site and send enquiries.' },
          { title: 'Open your reports', body: 'See the summary in your business app.' },
          { title: 'Act on it', body: 'Update your content or follow up with customers.' },
        ],
        plan: 'Which reports you see depends on your plan and your business area. Free sites are informational.',
        faq: [
          { q: 'Do reports replace my accounts?', a: 'No. Reports help you understand your business. They are not an accounting record.' },
          { q: 'Who can see them?', a: 'You and the team members you add to your business app.' },
        ],
        related: ['enquiries', 'business-tools', 'website'],
      },
      {
        slug: 'ai-studio', name: 'AI Studio', metaTitle: 'AI Studio for your business site',
        metaDescription: 'Draft text and images for your site with AI Studio, then check and edit them yourself before they go live.',
        h1: 'AI Studio', lead: 'Draft text and images for your site with AI Studio. You always check and edit a draft before it goes on your site.',
        gives: ['Drafts of text for your pages', 'Drafts of images for your site', 'Your check and edit before anything is published'],
        steps: [
          { title: 'Describe what you need', body: 'Tell AI Studio about the page or picture you want.' },
          { title: 'Check the draft', body: 'Read it, change it, or ask again.' },
          { title: 'Publish', body: 'Use the draft on your site once you are happy with it.' },
        ],
        plan: 'Availability depends on your plan. AI drafts can be wrong, so check every draft before you use it.',
        faq: [
          { q: 'Is AI text published automatically?', a: 'No. A draft only goes on your site when you choose to use it.' },
          { q: 'Do I have to use it?', a: 'No. You can write and edit your own content in your business app.' },
        ],
        related: ['website', 'search-visibility', 'business-tools'],
      },
      {
        slug: 'domains', name: 'Domains', metaTitle: 'Your own domain name for your site',
        metaDescription: 'Start on your own subdomain, then connect a domain name of your own on a paid plan. Step-by-step help in your business app.',
        h1: 'Domains', lead: 'Your site starts on its own subdomain. On a paid plan you can connect a domain name of your own.',
        gives: ['A site address on your own subdomain from the start', 'A domain name of your own on a paid plan', 'Step-by-step connection in your business app', 'A choice of which address is your main one'],
        steps: [
          { title: 'Start on your subdomain', body: 'Your free site is live on the address you chose.' },
          { title: 'Add your domain', body: 'On a paid plan, enter your domain name in your business app.' },
          { title: 'Connect and check', body: 'Follow the steps to point the domain at your site, then check the connection.' },
        ],
        plan: 'A domain name of your own needs a paid plan. When a paid plan ends, your own domain stops working and visitors are sent to your subdomain. Your data and your theme are kept.',
        faq: [
          { q: 'Do I need a domain name to start?', a: 'No. Your free site lives on your own subdomain.' },
          { q: 'What happens to my domain if my plan ends?', a: 'Your own domain stops working and visitors are sent to your subdomain. Your data and your theme are kept.' },
        ],
        related: ['website', 'search-visibility', 'business-tools'],
      },
      {
        slug: 'business-tools', name: 'Business tools', metaTitle: 'Business tools in your business app',
        metaDescription: 'Customers, invoices, payments and the working areas of your business area, together in your business app.',
        h1: 'Business tools', lead: 'Your business app holds the tools for running your business, with working areas that suit your business area.',
        gives: ['Customers and their history', 'Invoices and payment requests', 'A wallet and plan billing', 'Team members with their own access', 'Working areas for your business area, such as jobs, orders, bookings or listings', 'Support from inside the app'],
        steps: [
          { title: 'Sign in', body: 'Open your business app with the account you registered.' },
          { title: 'Pick your working area', body: 'Your category decides which working areas you see.' },
          { title: 'Run your day', body: 'Record customers, send invoices and follow up on enquiries.' },
        ],
        plan: 'The main features of your business area need a paid plan. Free sites are informational.',
        faq: [
          { q: 'Do all businesses get the same tools?', a: 'No. Your business area decides the working areas you see. The industries pages list them.' },
          { q: 'Can my team use it?', a: 'Yes. You can add team members and choose what each person can see.' },
        ],
        related: ['enquiries', 'reports', 'ai-studio'],
      },
    ] as readonly ProductPage[],
  },

  partners: {
    metaTitle: 'Partner programme',
    metaDescription: 'Introduce businesses to Get4Domain with your own partner link. How the partner programme works and where to ask about it.',
    h1: 'Partner programme',
    lead: 'Introduce businesses to Get4Domain and take part in what they pay for a plan, through your own partner link.',
    howHeading: 'How it works',
    steps: [
      { title: 'We set you up', body: 'The Get4Domain team creates your partner account and your partner link.' },
      { title: 'You share your link', body: 'A business that opens your link and registers is connected to you.' },
      { title: 'The business grows', body: 'When the business moves to a paid plan, your share is recorded.' },
      { title: 'You are paid', body: 'You see your businesses, your share and your payouts in the partner portal.' },
    ],
    portalHeading: 'The partner portal',
    portal: ['Your partner link', 'The businesses you introduced', 'The share recorded for each plan payment', 'Your payouts'],
    termsHeading: 'The terms',
    termsBody: 'The partner programme has its own terms. Read them before you apply.',
    termsLink: 'Partner Programme Terms',
    ctaHeading: 'Talk to us about becoming a partner',
    ctaBody: 'The team creates partner accounts. Write to us and we will tell you what happens next.',
    ctaLink: 'Contact us',
    faqHeading: 'Common questions',
    faq: [
      { q: 'How do I become a partner?', a: 'Write to us on the contact page. The Get4Domain team creates partner accounts.' },
      { q: 'How is my share worked out?', a: 'The terms and the share are set by the Get4Domain team and shown in your partner portal. They are not listed on this page.' },
      { q: 'What does the business I introduce see?', a: 'It registers as any business does and starts with a free site.' },
    ] as readonly Faq[],
  },

  guides: {
    metaTitle: 'Guides for business websites',
    metaDescription: 'Plain guides on what a business website needs, choosing a site address, how search engines find a site, handling enquiries and moving to a paid plan.',
    h1: 'Guides',
    lead: 'Short, plain guides for owners of small businesses. They explain the ideas and do not promise results.',
    read: 'Read the guide',
    crumb: 'Guides',
    relatedHeading: 'Keep reading',
    ctaHeading: 'Ready to try it?',
    ctaBody: 'Start with a free site and see your business online.',
    ctaPrimary: 'Start free',
    hubLink: 'All guides',
    pages: [
      {
        slug: 'what-a-business-website-needs', title: 'What a business website needs',
        metaDescription: 'The few things every small business website needs: who you are, what you do, where you work and how a customer gets in touch.',
        lead: 'A business website does not need to be large. It needs to answer the questions a customer has before they get in touch.',
        sections: [
          { h: 'Say who you are', body: ['Use your business name the way customers know it. Add a short sentence that says what kind of business you are.'] },
          { h: 'Say what you do', body: ['List your main services or products in plain words. A customer should understand what you provide without reading a long page.', 'Use the words your customers use, not the words of your trade.'] },
          { h: 'Say where you work', body: ['Name the town or area you serve. If customers come to you, add your address. If you go to them, list the areas you cover.'] },
          { h: 'Make contact easy', body: ['Show one clear way to get in touch. On a paid plan your site can have an enquiry form and contact links. A free site is informational.'] },
          { h: 'Keep it current', body: ['Change the content when your services, address or details change. An out-of-date page can send a customer to the wrong place.'] },
        ],
        links: ['choosing-your-site-address', 'how-search-engines-find-your-site'],
      },
      {
        slug: 'choosing-your-site-address', title: 'Choosing your site address',
        metaDescription: 'How to pick a site address that is easy to say, easy to remember and easy to type, and what changes when you add a domain name of your own.',
        lead: 'Your site address is how customers reach you. A good one is short, clear and easy to say aloud.',
        sections: [
          { h: 'Keep it short', body: ['Short addresses are easier to remember and easier to type on a phone. Use your business name if it is available.'] },
          { h: 'Use letters, numbers and hyphens', body: ['An address can use letters, numbers and hyphens. It cannot start or end with a hyphen. Some names are reserved, and some are already taken.'] },
          { h: 'Say it aloud', body: ['If you would have to spell it out each time, choose another. Avoid spellings that are easy to get wrong.'] },
          { h: 'Subdomain and domain name', body: ['Your site starts on your own subdomain. On a paid plan you can connect a domain name of your own. When a paid plan ends, your own domain stops working and visitors are sent to your subdomain.'] },
        ],
        links: ['what-a-business-website-needs', 'from-free-to-paid-plan'],
      },
      {
        slug: 'how-search-engines-find-your-site', title: 'How search engines find your site',
        metaDescription: 'A plain explanation of how search engines discover and read a business website, and what you can do to help them. No promises about position.',
        lead: 'Search engines send programs across the web to read pages. If a page is easy to read, it is easier for a search engine to understand.',
        sections: [
          { h: 'Discovery', body: ['A search engine finds pages by following links and by reading a sitemap, which is a list of the pages on a site. Your site has a sitemap made for you.'] },
          { h: 'Reading', body: ['The program reads the title, the description, the headings and the text. Clear headings and plain sentences help it understand what a page is about.'] },
          { h: 'Showing', body: ['The search engine decides whether to show a page and where. No one outside the search engine controls that, and no one can promise a position.'] },
          { h: 'What you can do', body: ['Write about your business in plain words, name the places you serve, and keep your pages current. Use your site address wherever customers see your business.'] },
        ],
        links: ['what-a-business-website-needs', 'handling-enquiries-well'],
      },
      {
        slug: 'handling-enquiries-well', title: 'Handling enquiries well',
        metaDescription: 'Simple habits for answering customer enquiries: reply clearly, keep a record, follow up, and ask before you contact someone for another reason.',
        lead: 'An enquiry is a customer asking for something. How you handle it shapes what they think of your business.',
        sections: [
          { h: 'Reply clearly', body: ['Answer the question that was asked. If you need more information, ask for it in one short message.'] },
          { h: 'Keep a record', body: ['Note who asked, what they asked and what you said. Your business app keeps enquiries in one place so nothing is lost.'] },
          { h: 'Follow up', body: ['If a customer has not answered, send one polite reminder. Then leave it.'] },
          { h: 'Respect consent', body: ['A person who sends an enquiry agrees to be contacted about that enquiry. Do not use their details for something else without asking.'] },
        ],
        links: ['what-a-business-website-needs', 'from-free-to-paid-plan'],
      },
      {
        slug: 'from-free-to-paid-plan', title: 'From the Free plan to a paid plan',
        metaDescription: 'What a free site gives you, what a paid plan adds, and how to decide when to move. Prices are shown without GST.',
        lead: 'You can start with a free site and move to a paid plan when you want the main features.',
        sections: [
          { h: 'What the Free plan gives you', body: ['A site on your own subdomain, starter content for your business area, and a listing in the directory. You can edit the content. Free sites are informational.'] },
          { h: 'What a paid plan adds', body: ['Buttons, forms and contact links on your site, a domain name of your own, and the main features of your business area.'] },
          { h: 'Choosing a plan', body: ['There are three plans: Handyman, Professional and Ecommerce. Handyman is for one-person service businesses, Professional is for firms and practices, and Ecommerce is for businesses that sell online.'] },
          { h: 'Billing terms and payment', body: ['Plans are billed quarterly, half-yearly or annually. Prices are shown without GST, and GST is added at checkout. Payment happens inside your business app, through our payment gateway.'] },
        ],
        links: ['choosing-your-site-address', 'handling-enquiries-well'],
      },
    ] as ReadonlyArray<{ slug: string; title: string; metaDescription: string; lead: string; sections: ReadonlyArray<{ h: string; body: readonly string[] }>; links: readonly string[] }>,
  },

  categoryPage: {
    metaDescription: 'A website for a {name}: what it gives your business, how it works, and how to start with a free site.',
    lead: 'Get a free site made for a {name}. Move to a paid plan when you want the main features of the {pack} area.',
    groupLine: 'Listed under: {family}.',
    givesHeading: 'Typical working areas',
    givesIntro: 'A {name} uses the working areas of the {pack} pack, in the business app, on a paid plan.',
    howHeading: 'How it works',
    steps: [
      { title: 'Register', body: 'Tell us about your business. Your industry and category are already chosen.' },
      { title: 'Your free site is live', body: 'It goes live right away on your own subdomain, with starter content for a {name}. Edit it yourself.' },
      { title: 'Move to a paid plan', body: 'To use the main features, choose a paid plan and pay inside your business app.' },
    ],
    note: 'Free sites are informational. Prices are shown without GST.',
    moreHeading: 'Other categories in {pack}',
    ctaHeading: 'Start with a free site',
    cta: 'Start free',
    packLink: 'About {pack}',
    pricingLink: 'See pricing',
    faqHeading: 'Common questions',
    faq: [
      { q: 'What does a {name} get?', a: 'A site on its own subdomain with starter content for a {name}, and the working areas of the {pack} pack on a paid plan: {gives}.' },
      { q: 'Do I pay to try it?', a: 'No. You register yourself and your free site goes live right away. Free sites are informational.' },
      { q: 'Can I change the starter content?', a: 'Yes. You edit the content of your site in your business app.' },
      { q: 'Which plan do I need?', a: 'To use the main features, move to any of the three paid plans. The pricing page shows each plan and its billing terms, without GST.' },
    ] as readonly Faq[],
  },

  packExtra: {
    categoriesLinkHeading: 'Categories',
    categoriesIntro: 'Choose your category to see what a site for it looks like.',
  },
} as const;
