import { NewService, ServicesStore } from '../services.store';

/**
 * The service catalogue seed (slice 5.16b, extended on 5 November 2026). WORDS ONLY: no rupee amount and no length of time appears in any text, and the seed never approves a price.
 * The price rows are the owner's decided prices (OWNER PRICE DECISION ADDENDUM, 5 November 2026), in whole paise EXCLUDING GST, source OWNER_DECISION_2026_11_05, seeded as PROPOSED with no date:
 * the owner gave no effective date, so a SUPER_ADMIN approves each row with one before it can be charged. Anything the owner marked TO CONFIRM (a POS campaign, the plan prices, the term
 * discounts) is not here. No other price is invented.
 * The loader is a dry run unless told to apply, safe to run twice (a service that already exists, or already has any price row, is left exactly as it is), and writes nothing to any existing row.
 */
export const OWNER_PRICE_SOURCE = 'OWNER_DECISION_2026_11_05';
export const THEME_SWITCH_PROPOSED_PAISE = 29_900;   // approved by the owner on 5 November 2026; still a PROPOSED row until a SUPER_ADMIN dates it
export const THEME_SWITCH_PROPOSED_NOTE = `${OWNER_PRICE_SOURCE}: the owner approved this fee. A SUPER_ADMIN approves the row with an effective date.`;

export interface OwnerPrice { serviceKey: string; amountPaise: number; unit: string }
/** Per unit, whole paise, excluding GST (GST is added where the money is added: at a wallet refill). Messages are wallet-metered, charged on delivery. */
export const OWNER_PRICE_SEED: ReadonlyArray<OwnerPrice> = [
  { serviceKey: 'THEME_SWITCH', amountPaise: THEME_SWITCH_PROPOSED_PAISE, unit: 'per switch' },
  { serviceKey: 'CAMPAIGN', amountPaise: 99_900, unit: 'per campaign' },
  { serviceKey: 'REEL_SLIDESHOW', amountPaise: 49_900, unit: 'per reel' },
  { serviceKey: 'REEL_CORPORATE', amountPaise: 99_900, unit: 'per reel' },
  { serviceKey: 'REEL_CINEMATIC', amountPaise: 299_900, unit: 'per reel' },
  { serviceKey: 'LOGO_DESIGN', amountPaise: 29_900, unit: 'per logo' },
  { serviceKey: 'POST_DESIGN', amountPaise: 9_900, unit: 'per single post' },
  { serviceKey: 'SEO_MANAGER_HIRE', amountPaise: 99_900, unit: 'per keyword' },
  { serviceKey: 'CONTENT_CREATOR_HIRE', amountPaise: 99_900, unit: 'per content piece' },
  { serviceKey: 'BLOG_CREATOR_HIRE', amountPaise: 99_900, unit: 'per campaign' },
  { serviceKey: 'MESSAGE_SMS', amountPaise: 55, unit: 'per message, DLT registered, charged on delivery' },
  { serviceKey: 'MESSAGE_EMAIL', amountPaise: 10, unit: 'per message, charged on delivery to the inbox or promotions tab' },
  { serviceKey: 'MESSAGE_WHATSAPP_MARKETING', amountPaise: 95, unit: 'per message, approved templates only' },
];
const priceNote = (o: OwnerPrice): string => (o.serviceKey === 'THEME_SWITCH' ? THEME_SWITCH_PROPOSED_NOTE : `${OWNER_PRICE_SOURCE}: ${o.amountPaise} paise ${o.unit}, excluding GST. A SUPER_ADMIN approves it with an effective date.`);

const base = { trackScope: [] as string[], planStateRule: 'PRO_ACTIVE_OR_GRACE' as const, status: 'ACTIVE' as const };
const REVIEW = 'You look at the finished work and approve it, or ask for changes. Nothing is charged until you approve.';

export const SERVICE_SEED: ReadonlyArray<NewService> = [
  { ...base, key: 'THEME_SWITCH', name: 'Theme switch', kind: 'SITE', doneBy: 'EITHER', deliveryKind: 'INSTANT', publicVisible: true, sortOrder: 10,
    shortDescription: 'Change the look of your website to another theme.',
    includesText: 'We apply the theme you choose and carry your content across, so nothing you wrote is lost. If you switch back, what you wrote there comes back with you. The theme is licensed for you to use while you have your plan; it does not become yours to keep.',
    approvalText: 'No approval is needed. You see a preview with your own content first, which costs nothing, and the change is made when you confirm.' },
  { ...base, key: 'CUSTOM_THEME', name: 'A theme made for your business', kind: 'SITE', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 20,
    shortDescription: 'Our team designs a theme just for your business.',
    includesText: 'Our team designs a theme from your brief and applies it to your site. The theme is made for your site only.', approvalText: REVIEW },
  { ...base, key: 'SETUP_HELP', name: 'Help setting up your site', kind: 'SETUP', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 30,
    shortDescription: 'Our team fills in your site so it is ready to publish.',
    includesText: 'Our team helps you enter your business details, services, photos and contact information so that your site is ready to publish.', approvalText: REVIEW },
  { ...base, key: 'DOMAIN_CONNECT_HELP', name: 'Help connecting your own domain', kind: 'DOMAIN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 40,
    shortDescription: 'Our team connects a domain you already own to your site.',
    includesText: 'Our team guides you through connecting a domain you already own to your site and checks that it opens your site.', approvalText: 'You confirm that your domain opens your site. Nothing is charged until you approve.' },
  { ...base, key: 'CONTENT_UPDATE', name: 'Content update', kind: 'CONTENT', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 50,
    shortDescription: 'Our team updates the words, photos or sections on your site.',
    includesText: 'Our team updates the words, prices, photos or sections of your site from the details you send us.', approvalText: REVIEW },
  { ...base, key: 'POSTER_DESIGN', name: 'Poster design', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 60,
    shortDescription: 'A poster for your business, designed by our team.',
    includesText: 'One poster designed by our team from your brief, in the sizes you ask for.', approvalText: REVIEW },
  { ...base, key: 'LOGO_DESIGN', name: 'Logo design', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 62,
    shortDescription: 'A logo for your business, designed by our team.',
    includesText: 'One logo designed by our team from your brief, handed to you in the file types you need.', approvalText: REVIEW },
  { ...base, key: 'POST_DESIGN', name: 'Single post design', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 64,
    shortDescription: 'One social media post, designed by our team.',
    includesText: 'One single post designed by our team from the words and photos you send, ready to use.', approvalText: REVIEW },
  { ...base, key: 'REEL_SLIDESHOW', name: 'Reel: slideshow', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 70,
    shortDescription: 'A slideshow video for social media made by our team.',
    includesText: 'One slideshow video made by our team from the photos and words you send, with background music or a voice-over.', approvalText: REVIEW },
  { ...base, key: 'REEL_CORPORATE', name: 'Reel: corporate presentation', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 72,
    shortDescription: 'A corporate presentation video made by our team.',
    includesText: 'One corporate presentation video made by our team from the material you send, with background music or a voice-over.', approvalText: REVIEW },
  { ...base, key: 'REEL_CINEMATIC', name: 'Reel: cinematic', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 74,
    shortDescription: 'A cinematic video made by our team.',
    includesText: 'One cinematic video made by our team from your brief and material, with background music or a voice-over.', approvalText: REVIEW },
  { ...base, key: 'DOCUMENT_DESIGN', name: 'Document design', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 80,
    shortDescription: 'Menus, brochures, price lists or letterheads laid out for you.',
    includesText: 'One document such as a menu, brochure, price list or letterhead, laid out and designed by our team from your details.', approvalText: REVIEW },
  { ...base, key: 'SEO_TASK', name: 'Search improvement task', kind: 'SEO', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 90,
    shortDescription: 'One task that helps people find your business in search.',
    includesText: 'One search improvement task for your site, such as page titles, descriptions or listing details, done by our team.', approvalText: REVIEW },
  { ...base, key: 'SEO_MANAGER_HIRE', name: 'SEO manager', kind: 'SEO', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 92,
    shortDescription: 'Hire our team to work on one search keyword for you.',
    includesText: 'Our team works on one search keyword for your site: the pages, titles and descriptions that help people find your business for it. No guarantee of ranking.', approvalText: REVIEW },
  { ...base, key: 'CONTENT_CREATOR_HIRE', name: 'Content creator', kind: 'CONTENT', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 94,
    shortDescription: 'Hire our team to write one piece of content for you.',
    includesText: 'Our team writes one piece of content for your business from the details you send.', approvalText: REVIEW },
  { ...base, key: 'BLOG_CREATOR_HIRE', name: 'Blog creator', kind: 'CONTENT', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 96,
    shortDescription: 'Hire our team to run a blog campaign for you.',
    includesText: 'Our team plans and writes the blog posts of one campaign for your site from the details you send.', approvalText: REVIEW },
  { ...base, key: 'GBP_SETUP', name: 'Google Business Profile setup', kind: 'LISTING', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 100,
    shortDescription: 'Our team sets up or tidies your Google Business Profile.',
    includesText: 'Our team sets up or tidies your Google Business Profile using your business details.', approvalText: REVIEW },
  { ...base, key: 'SOCIAL_MANAGEMENT_REQUEST', name: 'Social media request', kind: 'SOCIAL', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 110,
    shortDescription: 'Ask our team to prepare a social media post for you.',
    includesText: 'Our team prepares a social media post from the details you send and hands it to you ready to use.', approvalText: REVIEW },
  { ...base, key: 'CUSTOM_DOMAIN_PROMOTION', name: 'Custom domain promotion', kind: 'DOMAIN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 120,
    shortDescription: 'Make your own domain the main address of your site.',
    includesText: 'Your site is shown on your own domain, and your free address points to it. This stays in place until the end date that is set when the service is approved.',
    approvalText: 'You approve once your site opens on your domain. Our team then makes it your main address.' },
  // Drafts: priced now so the number is on record, but not offered until their own modules exist (the campaign module, the messaging module). A draft is never shown or bought.
  { ...base, status: 'DRAFT' as const, key: 'CAMPAIGN', name: 'Campaign', kind: 'CAMPAIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: false, sortOrder: 130,
    shortDescription: 'A campaign on our own pages and channels that points people to your site.',
    includesText: 'A campaign for brand awareness, website visits or enquiries, run on our own pages and channels only, pointing to your subdomain or your own domain. There is no guarantee of results.', approvalText: REVIEW },
  { ...base, status: 'DRAFT' as const, key: 'MESSAGE_SMS', name: 'Text message', kind: 'MESSAGING', doneBy: 'VENDOR', deliveryKind: 'INSTANT', publicVisible: false, sortOrder: 140,
    shortDescription: 'A text message to your own customers who agreed to hear from you.',
    includesText: 'One text message, sent through a registered route, to a customer of yours who agreed to receive messages. It is charged only when it is delivered.', approvalText: 'No approval is needed. You see the cost before you send.' },
  { ...base, status: 'DRAFT' as const, key: 'MESSAGE_EMAIL', name: 'Email', kind: 'MESSAGING', doneBy: 'VENDOR', deliveryKind: 'INSTANT', publicVisible: false, sortOrder: 142,
    shortDescription: 'An email to your own customers who agreed to hear from you.',
    includesText: 'One email to a customer of yours who agreed to receive messages. It is charged only when it is delivered to the inbox or the promotions tab.', approvalText: 'No approval is needed. You see the cost before you send.' },
  { ...base, status: 'DRAFT' as const, key: 'MESSAGE_WHATSAPP_MARKETING', name: 'WhatsApp marketing message', kind: 'MESSAGING', doneBy: 'VENDOR', deliveryKind: 'INSTANT', publicVisible: false, sortOrder: 144,
    shortDescription: 'A WhatsApp message to your own customers who agreed to hear from you.',
    includesText: 'One WhatsApp marketing message, using an approved template, to a customer of yours who agreed to receive messages.', approvalText: 'No approval is needed. You see the cost before you send.' },
];

/** Services that a plan may include some of: staff set the numbers later in the admin tools. THEME_SWITCH is not one (its included switch is a rule, not a count); the campaign and the messages are wallet-metered only. */
const NO_ALLOWANCE: ReadonlySet<string> = new Set(['THEME_SWITCH', 'CAMPAIGN', 'MESSAGE_SMS', 'MESSAGE_EMAIL', 'MESSAGE_WHATSAPP_MARKETING']);
export const ALLOWANCE_SERVICE_KEYS: ReadonlyArray<string> = SERVICE_SEED.filter((s) => !NO_ALLOWANCE.has(s.key)).map((s) => s.key);
export const allowanceFeatureKey = (serviceKey: string): string => `services.included.${serviceKey}`;

/** The feature catalogue, for the loader only. A feature with no plan cell is HIDDEN for every plan: nothing is included until staff set a value. */
export interface FeatureSeedPort {
  existingKeys(keys: readonly string[]): Promise<string[]>;
  create(rows: ReadonlyArray<{ key: string; name: string; group: string; kind: 'LIMIT'; unit: string; description: string; sortOrder: number }>): Promise<void>;
}

export interface ServicesSeedReport {
  existingServices: string[]; missingServices: string[]; createdServices: string[];
  priceProposed: boolean; priceAlreadyThere: boolean;
  /** the owner price rows a run would write (or did write): every owner price whose service has no price row yet */
  pricesToWrite: Array<{ serviceKey: string; amountPaise: number }>;
  existingFeatures: string[]; missingFeatures: string[]; createdFeatures: string[];
  /** every price row the seed wrote, with its status: always PROPOSED */
  priceRowsWritten: Array<{ serviceKey: string; amountPaise: number; status: 'PROPOSED' }>;
}

export async function seedServices(store: ServicesStore, features: FeatureSeedPort, o: { apply: boolean }): Promise<ServicesSeedReport> {
  const have = new Set((await store.services()).map((s) => s.key));
  const missingServices = SERVICE_SEED.filter((s) => !have.has(s.key)).map((s) => s.key);
  const featKeys = ALLOWANCE_SERVICE_KEYS.map(allowanceFeatureKey);
  const featHave = new Set(await features.existingKeys(featKeys));
  const missingFeatures = featKeys.filter((k) => !featHave.has(k));
  const withPrice = new Set<string>();   // services that already have a price row of any status: left exactly as they are
  for (const o of OWNER_PRICE_SEED) { const svc = await store.serviceByKey(o.serviceKey); if (svc && (await store.servicePrices(svc.id)).length > 0) withPrice.add(o.serviceKey); }
  const priceAlreadyThere = withPrice.size > 0;
  const report: ServicesSeedReport = {
    existingServices: SERVICE_SEED.filter((s) => have.has(s.key)).map((s) => s.key), missingServices, createdServices: [], priceProposed: false, priceAlreadyThere,
    pricesToWrite: OWNER_PRICE_SEED.filter((o) => !withPrice.has(o.serviceKey)).map((o) => ({ serviceKey: o.serviceKey, amountPaise: o.amountPaise })),
    existingFeatures: featKeys.filter((k) => featHave.has(k)), missingFeatures, createdFeatures: [], priceRowsWritten: [],
  };
  if (!o.apply) return report;

  await store.unit(async (tx) => {
    for (const s of SERVICE_SEED) if (missingServices.includes(s.key)) { await tx.insertService({ ...s, trackScope: [...s.trackScope] }); report.createdServices.push(s.key); }
    for (const o of OWNER_PRICE_SEED) {
      const svc = await tx.serviceByKey(o.serviceKey);
      if (!svc || (await tx.servicePrices(svc.id)).length > 0) continue;
      await tx.insertServicePrice({ ownerId: svc.id, amountPaise: o.amountPaise, currency: 'INR', taxCategory: 'ALL', taxInclusive: false, effectiveFrom: null, note: priceNote(o), createdBy: OWNER_PRICE_SOURCE });
      report.priceProposed = true; report.priceRowsWritten.push({ serviceKey: o.serviceKey, amountPaise: o.amountPaise, status: 'PROPOSED' });
    }
    if (report.createdServices.length || report.priceProposed) await tx.audit({ type: 'SYSTEM', id: null, ip: null }, 'services.seed', null, null, { services: report.createdServices, priceProposed: report.priceProposed, source: OWNER_PRICE_SOURCE, priceRows: report.priceRowsWritten.length });
  });
  if (missingFeatures.length) {
    await features.create(missingFeatures.map((key, i) => {
      const svc = SERVICE_SEED.find((s) => allowanceFeatureKey(s.key) === key)!;
      return { key, name: `Included: ${svc.name}`, group: 'services', kind: 'LIMIT' as const, unit: 'requests', description: `How many ${svc.name.toLowerCase()} requests a plan includes. Empty until staff set it for a plan.`, sortOrder: 900 + i };
    }));
    report.createdFeatures = [...missingFeatures];
  }
  return report;
}
