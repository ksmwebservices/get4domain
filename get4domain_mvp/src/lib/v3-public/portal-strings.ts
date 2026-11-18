/**
 * Every static word of the portal design (dispatch J1): header, footer, search, home sections, directory home and results, industry pages.
 * Same copy rules as site-strings.ts, tested in __tests__/portal.test.ts over every static string here: never workspace, BOS or LeadSpace; "enquiries" not "leads";
 * no timeframes, no written price or percentage, no discount or offer wording, no ranking claims, no counts or ratings.
 * The few sentences that carry a number computed from real data (category counts, the annual saving from the price route) are functions at the end of this file.
 */
export const PORTAL = {
  brand: 'Get4Domain',
  tagline: 'Local search and business websites',
  skip: 'Skip to content',

  nav: {
    label: 'Main',
    categories: 'Categories',
    directory: 'Directory',
    product: 'Product',
    growth: 'Growth',
    pricing: 'Pricing',
    how: 'How it works',
    industries: 'Industries',
    guides: 'Guides',
    partners: 'Partners',
    signIn: 'Sign in',
    start: 'Start free',
    list: 'List your business',
    claim: 'Claim a listing',
    menu: 'Menu',
    closeMenu: 'Close menu',
    allCategories: 'All categories',
    chooseArea: 'Business areas',
    viewArea: 'View this whole area',
    more: 'More',
  },

  /** The phone bottom bar and the install item (dispatch P2.6). */
  app: {
    barLabel: 'App menu',
    home: 'Home',
    search: 'Search',
    categories: 'Categories',
    plans: 'Plans',
    more: 'More',
    moreTitle: 'More',
    close: 'Close',
    install: 'Install app',
    installDone: 'Thank you. The app is being added to your device.',
    iosTitle: 'Add to Home Screen',
    iosSteps: 'Tap the Share button in your browser, then choose "Add to Home Screen".',
    iosGotIt: 'Got it',
  },

  search: {
    label: 'Search',
    tabsLabel: 'What do you want to find?',
    tabBusiness: 'Find a business',
    tabDomain: 'Find a domain or website name',
    whatLabel: 'What are you looking for?',
    whatPlaceholder: 'Plumber, dentist, AC repair',
    whereLabel: 'Where?',
    wherePlaceholder: 'City or area',
    submit: 'Search',
    suggestCategories: 'Categories',
    suggestPlaces: 'Places',
    suggestHint: 'Suggestions are filled in as you type. Use the arrow keys and Enter to choose one.',
    helper: 'Matches the business name, its description, its category and its place.',
    domainLabel: 'Choose your website name',
    domainPlaceholder: 'yourbusiness',
    domainHelper: 'Your free site goes live on this address.',
    checking: 'Checking the address',
    state: {
      available: 'This address is available.',
      taken: 'This address is already taken. Try another.',
      reserved: 'This address is reserved. Try another.',
      invalid: 'Use letters, numbers and hyphens only.',
      short: 'This address is too short.',
      unknown: 'The address could not be checked just now. You can still try it when you register.',
    },
    createSite: 'Create this site',
    customLabel: 'Already own a domain name?',
    customPlaceholder: 'yourbusiness.com',
    customCta: 'Connect a domain you own',
    customNote: 'Registering new domain names opens soon. Until then you can connect a domain you already own, on a paid plan.',
    tryDomain: 'Check a website name',
  },

  home: {
    eyebrow: 'Local business directory, search and web app',
    h1: 'Find any local business. Get a website for yours.',
    lead: 'Search for a business by keyword and place, or find a website name on the Get4Domain subdomain directory. Every business also gets a website, business tools, enquiry capture and promotion.',
    popularHeading: 'Popular searches',
    popularLabel: 'Popular searches',
    popular: ['Plumber', 'Electrician', 'Dentist', 'Salon', 'Gym', 'Restaurant', 'Car workshop', 'Tuition centre'],
    browseHeading: 'Browse by category',
    browseLead: 'Every business area has its own categories. Open an area to see them.',
    browseAll: 'See every category',
    expand: 'Show categories',
    howHeading: 'How it works',
    howLead: 'From a search box to a business site, in three steps.',
    showHeading: 'See what is inside',
    showLead: 'Your business app and your site, drawn as previews. These are layouts, not real customer data.',
    preview: 'Preview',
    tracksHeading: 'Plans for three kinds of business',
    tracksLead: 'Choose the track that fits how you work. Start with a free site first.',
    termLegend: 'Billing term',
    terms: { 3: 'Quarterly', 6: 'Half-yearly', 12: 'Annual' } as Record<number, string>,
    gst: 'Prices are shown without GST. GST is added at checkout.',
    pricesPending: 'Prices are being set.',
    pricePending: 'Price not set yet',
    notOffered: 'Not offered for this term',
    choose: 'Choose',
    comparePlans: 'Compare every feature',
    directoryHeading: 'From the directory',
    directoryLead: 'Businesses listed by city and category. Each one links to its own site.',
    directoryEmptyTitle: 'The directory is just getting started',
    directoryEmptyBody: 'No businesses are listed yet. Be among the first: list your business, or claim a listing that already carries your name.',
    openDirectory: 'Open the directory',
    domainHeading: 'Pick your website name',
    domainLead: 'Every business starts on its own address under get4domain.com. Check that yours is free.',
    faqHeading: 'Questions and answers',
    ctaHeading: 'Start with a free site',
    ctaBody: 'Register, look over your site, and move to a paid plan when you want the main features.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'See how it works',
    learnMore: 'Learn more',
  },

  /** The six preview panels on the home page. `href` is a main-site path. */
  panels: [
    { key: 'dashboard', title: 'Your business app', body: 'One place for customers, orders, invoices and the working areas of your business.', href: '/product/business-tools' },
    { key: 'editor', title: 'Edit your website', body: 'Change text, photos, pages and contact details yourself, and pick a theme that suits your business.', href: '/product/website' },
    { key: 'enquiries', title: 'Enquiries in one list', body: 'Every enquiry from your site arrives in your business app, with a record of each customer.', href: '/product/enquiries' },
    { key: 'invoices', title: 'Invoices and payment requests', body: 'Make an invoice, send a payment request and keep the history with the customer.', href: '/product/business-tools' },
    { key: 'ai', title: 'Drafts from AI Studio', body: 'Get a first draft of text or an image, then check and edit it before it goes on your site.', href: '/product/ai-studio' },
    { key: 'directory', title: 'A listing people can search', body: 'Be found by city and category, with a Visit site link that opens your own site.', href: '/product/directory' },
  ] as ReadonlyArray<{ key: string; title: string; body: string; href: string }>,

  directory: {
    h1: 'Find a local business',
    lead: 'Search by what you need and where you are. Every result links to the business site and to its directory page.',
    browseCities: 'Browse by city',
    browseCategories: 'Browse by category',
    citiesEmpty: 'Cities appear here once businesses are listed.',
    categoriesEmpty: 'Categories appear here once businesses are listed.',
    missingHeading: 'Is your business missing from this page?',
    missingBody: 'List your business to appear on pages like this one, or claim a listing that already carries your name.',
    missingList: 'List your business',
    missingClaim: 'Claim a listing',
    emptyTitle: 'No businesses listed here yet',
    emptyBody: 'The directory is new and this search has no listings so far. Try a wider place or another word, or help us fill it.',
    emptyListTitle: 'Own a business?',
    emptyListBody: 'Create a free site and your business is listed in the directory.',
    claimTitle: 'Is your business already listed?',
    claimBody: 'Find the listing and claim it to manage it yourself.',
    results: 'Search results',
    resultsFor: 'Results',
    noResultsTitle: 'No matching businesses',
    noResultsBody: 'Nothing matches that search yet. Check the spelling, try a single word, or search a wider place.',
    unknownPlace: 'We do not have that place yet. Showing no results rather than guessing.',
    filters: 'Refine your search',
    filterCategory: 'Category',
    filterPlace: 'Place',
    anyCategory: 'Any category',
    anyPlace: 'Anywhere',
    apply: 'Apply',
    clear: 'Clear',
    visitSite: 'Visit site',
    viewListing: 'View listing',
    listingOnly: 'Directory listing only. This business has no site yet.',
    claimed: 'Claimed',
    verified: 'Verified',
    sponsored: 'Sponsored',
    prev: 'Previous page',
    next: 'Next page',
    backToDirectory: 'Back to the directory',
    couldNotSearch: 'The search could not be reached just now. Please try again.',
    metaTitle: 'Find a local business',
    metaDescription: 'Search businesses by what they do and where they are. Each result links to the business site.',
    searchMetaTitle: 'Search results',
  },

  industries: {
    hubHeading: 'Business areas',
    hubLead: 'Pick the area that matches your business. Each one has its own categories, tools and starter site.',
    gives: 'What this area gives your business',
    categories: 'Categories in this area',
    suits: 'Suits',
    sample: 'A sample site layout',
    sampleNote: 'A drawing of how a site in this area can be laid out. It is not a real business.',
    start: 'Start free',
    seePlans: 'See plans',
    searchThis: 'Search the directory',
    otherAreas: 'Other business areas',
  },

  footer: {
    label: 'Footer',
    blurb: 'Local search and business websites, made by KSM Quantum Technologies.',
    find: 'Find',
    business: 'For businesses',
    learn: 'Learn',
    company: 'Company',
    about: 'About',
    contact: 'Contact',
    legal: 'Legal',
    note: 'Prices are shown without GST. GST is added at checkout.',
  },
} as const;

/** "16 business areas and 196 categories", from the real catalogue. */
export const browseCount = (areas: number, categories: number): string => `${areas} business areas and ${categories} categories.`;

/** The annual price against four quarterly prices, as a whole percentage worked out from the price route. Shown only when it is a real positive number. */
export const annualSaving = (percent: number): string => `Save ${percent}% with annual`;

/** The billing term dropdown option: "Annual (save 33%)" when the saving is real, else just the term name. */
export const termOption = (name: string, savingPercent: number | null): string => (savingPercent === null ? name : `${name} (save ${savingPercent}%)`);

/** The small line under the monthly price: "billed annually ₹3,600 + GST". The total is the real term price, shown without GST. */
export const billedLine = (term: number, total: string): string => `billed ${term === 12 ? 'annually' : term === 6 ? 'half-yearly' : 'quarterly'} ${total} + GST`;

/** "12 businesses found", from the real total of a search. */
export const resultCount = (n: number): string => (n === 1 ? '1 business found' : `${n} businesses found`);

/** "Page 2 of 5" for the pager of the results. */
export const pageOf = (n: number, total: number): string => `Page ${n} of ${total}`;

/** The unit beside the large monthly price (a function-side string: the copy tests walk the PORTAL object, and a time word is allowed here only as this label). */
export const PER_MONTH = 'per month';
export const TERM_LABEL = 'Billing term';
