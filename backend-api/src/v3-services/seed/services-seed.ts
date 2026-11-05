import { NewService, ServicesStore } from '../services.store';

/**
 * The service catalogue seed (slice 5.16b). WORDS ONLY: no rupee amount and no length of time appears in any text, and the seed never approves a price.
 * The ONE price row is the owner's intended fee for THEME_SWITCH, seeded as PROPOSED so that staff approve it (with an effective date) before it can be charged. No other price is invented.
 * The loader is a dry run unless told to apply, safe to run twice (a service or price that already exists is left exactly as it is), and writes nothing to any existing row.
 */
export const THEME_SWITCH_PROPOSED_PAISE = 29_900;   // the owner's stated intended fee (owner rule 5), as a PROPOSAL only
export const THEME_SWITCH_PROPOSED_NOTE = 'Proposed from the owner\'s stated intended fee. Staff approve it with an effective date, or change it first.';

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
  { ...base, key: 'REEL_PRODUCTION', name: 'Reel production', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 70,
    shortDescription: 'A short video for social media made by our team.',
    includesText: 'One short video made by our team from the photos, words and music choices you send.', approvalText: REVIEW },
  { ...base, key: 'DOCUMENT_DESIGN', name: 'Document design', kind: 'DESIGN', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 80,
    shortDescription: 'Menus, brochures, price lists or letterheads laid out for you.',
    includesText: 'One document such as a menu, brochure, price list or letterhead, laid out and designed by our team from your details.', approvalText: REVIEW },
  { ...base, key: 'SEO_TASK', name: 'Search improvement task', kind: 'SEO', doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST', publicVisible: true, sortOrder: 90,
    shortDescription: 'One task that helps people find your business in search.',
    includesText: 'One search improvement task for your site, such as page titles, descriptions or listing details, done by our team.', approvalText: REVIEW },
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
];

/** Services that a plan may include some of: staff set the numbers later in the admin tools. THEME_SWITCH is not one (its included switch is a rule, not a count). */
export const ALLOWANCE_SERVICE_KEYS: ReadonlyArray<string> = SERVICE_SEED.filter((s) => s.key !== 'THEME_SWITCH').map((s) => s.key);
export const allowanceFeatureKey = (serviceKey: string): string => `services.included.${serviceKey}`;

/** The feature catalogue, for the loader only. A feature with no plan cell is HIDDEN for every plan: nothing is included until staff set a value. */
export interface FeatureSeedPort {
  existingKeys(keys: readonly string[]): Promise<string[]>;
  create(rows: ReadonlyArray<{ key: string; name: string; group: string; kind: 'LIMIT'; unit: string; description: string; sortOrder: number }>): Promise<void>;
}

export interface ServicesSeedReport {
  existingServices: string[]; missingServices: string[]; createdServices: string[];
  priceProposed: boolean; priceAlreadyThere: boolean;
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
  const theme = await store.serviceByKey('THEME_SWITCH');
  const priceAlreadyThere = theme ? (await store.servicePrices(theme.id)).length > 0 : false;
  const report: ServicesSeedReport = {
    existingServices: SERVICE_SEED.filter((s) => have.has(s.key)).map((s) => s.key), missingServices, createdServices: [], priceProposed: false, priceAlreadyThere,
    existingFeatures: featKeys.filter((k) => featHave.has(k)), missingFeatures, createdFeatures: [], priceRowsWritten: [],
  };
  if (!o.apply) return report;

  await store.unit(async (tx) => {
    for (const s of SERVICE_SEED) if (missingServices.includes(s.key)) { await tx.insertService({ ...s, trackScope: [...s.trackScope] }); report.createdServices.push(s.key); }
    const t = await tx.serviceByKey('THEME_SWITCH');
    if (t && (await tx.servicePrices(t.id)).length === 0) {
      await tx.insertServicePrice({ ownerId: t.id, amountPaise: THEME_SWITCH_PROPOSED_PAISE, currency: 'INR', taxCategory: 'ALL', taxInclusive: false, effectiveFrom: null, note: THEME_SWITCH_PROPOSED_NOTE, createdBy: 'seed' });
      report.priceProposed = true; report.priceRowsWritten.push({ serviceKey: 'THEME_SWITCH', amountPaise: THEME_SWITCH_PROPOSED_PAISE, status: 'PROPOSED' });
    }
    if (report.createdServices.length || report.priceProposed) await tx.audit({ type: 'SYSTEM', id: null, ip: null }, 'services.seed', null, null, { services: report.createdServices, priceProposed: report.priceProposed });
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
