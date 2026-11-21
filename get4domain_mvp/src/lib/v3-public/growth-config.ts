/**
 * THE one place that says what a Pro plan includes. The owner changes a service here (its group, its label, whether the Free plan has it) and the growth page, the home sections,
 * the pricing comparison and the footer all follow. No number lives here: allowances are said in words only.
 *
 * Three groups (P6.4), each with one plain label:
 *  run   "Run for you by Get4Domain": work our team does for the business. Label "Included in Pro", with a monthly or yearly allowance by plan.
 *  tools "Self-serve tools in your business app": ONLY what the vendor app really has working today (see the decision table in docs/v3/DISPATCH_REPORT_P6.md).
 *  addon "Custom domain pack": SEO, social media and a communication hub on the business's own domain. Add-on pack, price on request.
 * A fourth, internal group "base" holds the two directory rows the Free plan has too; it is a row of the pricing comparison, not a section.
 *
 * Nothing that is not built is listed (P6 addendum): there is no "launching soon", no "coming soon" and no automated campaign builder anywhere. A feature the vendor app does not
 * really offer today is simply absent, and comes back here (one row) when the owner decides.
 *
 * How promotion works (the business model, kept honest):
 *  1. Directory pages, e.g. "plumbers in Vadapalani". We target them with SEO, AEO and GEO. They list the vendors.
 *  2. The vendor's own Get4Domain subdomain site, e.g. plumberkumar.get4domain.com. It is promoted directly from time to time with a presentation, and on the annual plan our team
 *     also makes reels and a poster, promoted to the subdomain only.
 *  Promotion never runs on a vendor's custom domain: that is the custom domain pack.
 * Nothing here promises a result (no ranking, no traffic, no enquiry count).
 */
export type GrowthStatus = 'included' | 'pro' | 'addon';
export type GrowthGroup = 'base' | 'run' | 'tools' | 'addon';
export type GrowthIcon = 'globe' | 'wrench' | 'search' | 'pin' | 'chart' | 'tag' | 'store' | 'video' | 'pen' | 'file' | 'mail' | 'chat' | 'share' | 'list' | 'megaphone' | 'image' | 'presentation' | 'plus' | 'inbox' | 'receipt' | 'users';

export const GROWTH_STATUS_LABEL: Record<GrowthStatus, string> = {
  included: 'Included',
  pro: 'Included in Pro',
  addon: 'Add-on pack, price on request',
};

export interface GrowthService {
  key: string;
  group: GrowthGroup;
  name: string;
  /** one honest sentence: what it is. It never promises a result. */
  summary: string;
  icon: GrowthIcon;
  /** the label shown on the service (one in practice) */
  statuses: readonly GrowthStatus[];
  /** which plans carry it. 'pro' means every Pro plan. */
  plans: 'pro' | 'ecommerce';
  /** what the Free plan column says: 'included' (it has it) or 'locked' */
  free: 'included' | 'locked';
  /** a base row is not a growth service: the home grid and the footer leave it out */
  base?: boolean;
  /** a short plain note shown with the service, e.g. "Annual plan" */
  note?: string;
}

/** The three sections of the growth page and the footer column (the "base" rows are not a section). */
export const GROWTH_GROUPS: ReadonlyArray<{ key: Exclude<GrowthGroup, 'base'>; name: string; label: string; blurb: string }> = [
  { key: 'run', name: 'Run for you by Get4Domain', label: GROWTH_STATUS_LABEL.pro, blurb: 'Our team does this work for your business, with a monthly or yearly allowance by plan.' },
  { key: 'tools', name: 'Self-serve tools in your business app', label: GROWTH_STATUS_LABEL.pro, blurb: 'Tools you use yourself, in the business app that comes with a Pro plan.' },
  { key: 'addon', name: 'Custom domain pack', label: GROWTH_STATUS_LABEL.addon, blurb: 'Promotion runs on your Get4Domain subdomain and the directory pages. For your own domain name there is an add-on pack.' },
];

const PRO: readonly GrowthStatus[] = ['pro'];
const INCL: readonly GrowthStatus[] = ['included'];
const ADDON: readonly GrowthStatus[] = ['addon'];

export const GROWTH_SERVICES: readonly GrowthService[] = [
  // On every plan (a row of the pricing comparison)
  { key: 'dir-listing', group: 'base', name: 'Directory listing', summary: 'Your business is listed in the Get4Domain directory, by city and category.', icon: 'list', statuses: INCL, plans: 'pro', free: 'included', base: true },
  { key: 'dir-pages', group: 'base', name: 'Category-in-area directory pages', summary: 'Your listing appears on the page for your category in your area, such as plumbers in Vadapalani.', icon: 'pin', statuses: INCL, plans: 'pro', free: 'included', base: true },

  // (a) Run for you by Get4Domain: Included in Pro
  { key: 'campaigns', group: 'run', name: 'Campaigns by SMS, e-mail and WhatsApp', summary: 'Our team creates and sends campaigns to your own customers who agreed to receive them.', icon: 'megaphone', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'promotion', group: 'run', name: 'Search-engine and Meta promotion', summary: 'Our team promotes your subdomain and the keyword directory pages that list you, through search engines and Meta.', icon: 'share', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'seo', group: 'run', name: 'SEO, AEO and GEO', summary: 'Our team sets up and manages the search work on the directory pages that list you and on your subdomain.', icon: 'search', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'spotlight', group: 'run', name: 'Subdomain spotlight presentation', summary: 'From time to time your subdomain is promoted directly with a presentation made by our team.', icon: 'presentation', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'meta', group: 'run', name: 'Meta optimisation', summary: 'Our team writes and tunes the page titles and descriptions that search engines read.', icon: 'tag', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'analytics', group: 'run', name: 'Google Analytics and Search Console setup', summary: 'Our team connects both to your site so you can see how it is used.', icon: 'chart', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'merchant', group: 'run', name: 'Google Merchant profile', summary: 'Our team sets up your product listing in Google Merchant.', icon: 'store', statuses: PRO, plans: 'ecommerce', free: 'locked' },
  { key: 'reels', group: 'run', name: 'Reels', summary: 'Short videos made for your business by our team and promoted to your subdomain only.', icon: 'video', statuses: PRO, plans: 'pro', free: 'locked', note: 'On the annual plan' },
  { key: 'poster', group: 'run', name: 'Poster', summary: 'A poster made for your business by our team and promoted to your subdomain only.', icon: 'image', statuses: PRO, plans: 'pro', free: 'locked', note: 'On the annual plan' },
  { key: 'posts', group: 'run', name: 'Posts', summary: 'Social posts written and designed by our team.', icon: 'share', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'blogs', group: 'run', name: 'Blogs', summary: 'Articles for your site, written by our team and checked by you.', icon: 'file', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'writing', group: 'run', name: 'Content writing', summary: 'The words of your pages, written for your business by our team.', icon: 'pen', statuses: PRO, plans: 'pro', free: 'locked' },

  // (b) Self-serve tools: only what the vendor app has working today
  { key: 'sub-site', group: 'tools', name: 'Website on your Get4Domain subdomain', summary: 'A site for your business on its own address, for example plumberkumar.get4domain.com, edited in your business app.', icon: 'globe', statuses: PRO, plans: 'pro', free: 'included', base: true },
  { key: 'tools', group: 'tools', name: 'Business app', summary: 'Your customers, and for your kind of business jobs, quotes, bookings, orders and stock, in one web app.', icon: 'wrench', statuses: PRO, plans: 'pro', free: 'locked', base: true },
  { key: 'enquiries', group: 'tools', name: 'Enquiry capture', summary: 'Enquiries from your site arrive as records in your business app, where you follow each one up.', icon: 'inbox', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'billing', group: 'tools', name: 'Invoices and payments', summary: 'Invoices, payments by UPI and a record of your sales.', icon: 'receipt', statuses: PRO, plans: 'pro', free: 'locked' },
  { key: 'team', group: 'tools', name: 'Team and access', summary: 'Add your team and choose what each person can open.', icon: 'users', statuses: PRO, plans: 'pro', free: 'locked' },

  // (c) Custom domain pack
  { key: 'cd-seo', group: 'addon', name: 'SEO on your own domain', summary: 'Search work on a domain name you connect, as an add-on pack.', icon: 'plus', statuses: ADDON, plans: 'pro', free: 'locked' },
  { key: 'cd-social', group: 'addon', name: 'Social media on your own domain', summary: 'Social media work that points to a domain name you connect, as an add-on pack.', icon: 'plus', statuses: ADDON, plans: 'pro', free: 'locked' },
  { key: 'cd-hub', group: 'addon', name: 'Communication hub on your own domain', summary: 'Your messages to customers brought together for a domain name you connect, as an add-on pack.', icon: 'plus', statuses: ADDON, plans: 'pro', free: 'locked' },
];

/** The services of one group, in the order of the list above. */
export const servicesOf = (group: GrowthGroup): GrowthService[] => GROWTH_SERVICES.filter((s) => s.group === group);

/** The services of the three groups (not the base rows), for the home grid and the growth page. */
export const GROWTH_ONLY: readonly GrowthService[] = GROWTH_SERVICES.filter((s) => s.group === 'run');

/** The status labels of a service, one per status. */
export const statusLabels = (s: GrowthService): string[] => s.statuses.map((k) => GROWTH_STATUS_LABEL[k]);
