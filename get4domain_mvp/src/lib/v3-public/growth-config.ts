/**
 * THE one place that says which growth services exist and what state each one is in. The owner changes a service here (its group, its status, which plan it is for, whether the
 * Free plan has it) and the growth page, the home grid, the pricing comparison and the footer all follow. No number lives here: allowances are said in words only.
 *
 * How promotion works (the business model, kept honest):
 *  1. Directory pages, e.g. "plumbers in Vadapalani". We target them with SEO, AEO and GEO, and (launching soon) with Google and Meta ads that Get4Domain runs. They list the vendors.
 *  2. The vendor's own Get4Domain subdomain site, e.g. plumberkumar.get4domain.com. It is promoted directly from time to time with a presentation, and on the annual plan our team
 *     also makes reels and a poster, promoted to the subdomain only.
 *  Promotion never runs on a vendor's custom domain. SEO and paid ads for a custom domain are an add-on pack, price not set yet.
 * Frequency and quantities per plan are not decided, so there is no number anywhere: "with an allowance by plan".
 * Nothing here promises a result (no ranking, no traffic, no enquiry count).
 */
export type GrowthStatus = 'included' | 'team' | 'allowance' | 'soon' | 'addon';
export type GrowthGroup = 'directory' | 'subdomain' | 'google' | 'content' | 'campaigns' | 'addon';
export type GrowthIcon = 'globe' | 'wrench' | 'search' | 'pin' | 'chart' | 'tag' | 'store' | 'video' | 'pen' | 'file' | 'mail' | 'phone' | 'chat' | 'share' | 'list' | 'megaphone' | 'image' | 'presentation' | 'plus';

export const GROWTH_STATUS_LABEL: Record<GrowthStatus, string> = {
  included: 'Included',
  team: 'Included, done by our team',
  allowance: 'Included, with an allowance by plan',
  soon: 'Launching soon',
  addon: 'Add-on pack',
};

export interface GrowthService {
  key: string;
  group: GrowthGroup;
  name: string;
  /** one honest sentence: what it is. It never promises a result. */
  summary: string;
  icon: GrowthIcon;
  /** the labels shown on the service (one in practice) */
  statuses: readonly GrowthStatus[];
  /** which plans carry it. 'paid' means every paid plan. */
  plans: 'paid' | 'ecommerce';
  /** what the Free plan column says: 'included' (it has it) or 'locked' */
  free: 'included' | 'locked';
  /** a base row (the site and the tools themselves) is not a growth service: the home grid and the footer leave it out */
  base?: boolean;
  /** a short plain note shown with the service, e.g. "Annual plan" */
  note?: string;
}

export const GROWTH_GROUPS: ReadonlyArray<{ key: GrowthGroup; name: string; blurb: string }> = [
  { key: 'directory', name: 'Directory and local search', blurb: 'Pages such as plumbers in Vadapalani list the businesses of an area. We target these pages and list the vendors on them.' },
  { key: 'subdomain', name: 'Your subdomain site', blurb: 'Your business site on its own Get4Domain address, with the tools to run it, and promotion to that address.' },
  { key: 'google', name: 'Google presence', blurb: 'Work on how your business shows up in Google, set up and managed by our team.' },
  { key: 'content', name: 'Content and reels', blurb: 'Reels, posters, posts and writing made for your business by our team.' },
  { key: 'campaigns', name: 'Campaigns and social', blurb: 'Messages to your own customers and posting to your own accounts, from your business app. These are being built.' },
  { key: 'addon', name: 'Custom domain add-on', blurb: 'Promotion runs on the Get4Domain subdomain and directory pages, never on a custom domain. For a custom domain there is an add-on pack.' },
];

const TEAM: readonly GrowthStatus[] = ['team'];
const ALLOW: readonly GrowthStatus[] = ['allowance'];
const SOON: readonly GrowthStatus[] = ['soon'];
const INCL: readonly GrowthStatus[] = ['included'];
const ADDON: readonly GrowthStatus[] = ['addon'];

export const GROWTH_SERVICES: readonly GrowthService[] = [
  // Directory and local search
  { key: 'dir-listing', group: 'directory', name: 'Directory listing', summary: 'Your business is listed in the Get4Domain directory, by city and category.', icon: 'list', statuses: INCL, plans: 'paid', free: 'included' },
  { key: 'dir-pages', group: 'directory', name: 'Category-in-area directory pages', summary: 'Your listing appears on the page for your category in your area, such as plumbers in Vadapalani.', icon: 'pin', statuses: INCL, plans: 'paid', free: 'included' },
  { key: 'dir-seo', group: 'directory', name: 'SEO, AEO and GEO for the directory pages', summary: 'Our team sets up and manages the search work on the directory pages that list you.', icon: 'search', statuses: TEAM, plans: 'paid', free: 'locked' },
  { key: 'dir-ads', group: 'directory', name: 'Google and Meta ads for the directory pages', summary: 'Get4Domain runs ads that point to the directory pages that list you.', icon: 'megaphone', statuses: SOON, plans: 'paid', free: 'locked' },
  // Your subdomain site
  { key: 'sub-site', group: 'subdomain', name: 'Website on your Get4Domain subdomain', summary: 'A site for your business on its own address, for example plumberkumar.get4domain.com.', icon: 'globe', statuses: INCL, plans: 'paid', free: 'included', base: true },
  { key: 'tools', group: 'subdomain', name: 'Business app and tools', summary: 'Enquiries, customers, invoices, payments and reports in the tools web app.', icon: 'wrench', statuses: INCL, plans: 'paid', free: 'locked', base: true },
  { key: 'sub-seo', group: 'subdomain', name: 'SEO, AEO and GEO on your subdomain site', summary: 'Our team sets up and manages the search work on your own subdomain site.', icon: 'search', statuses: TEAM, plans: 'paid', free: 'locked' },
  { key: 'spotlight', group: 'subdomain', name: 'Subdomain spotlight presentation', summary: 'From time to time your subdomain site is promoted directly with a presentation made by our team.', icon: 'presentation', statuses: ALLOW, plans: 'paid', free: 'locked' },
  // Google presence
  { key: 'meta', group: 'google', name: 'Meta optimisation', summary: 'Our team writes and tunes the page titles and descriptions that search engines read.', icon: 'tag', statuses: TEAM, plans: 'paid', free: 'locked' },
  { key: 'local-keywords', group: 'google', name: 'Local-area keywords', summary: 'Our team picks the words your customers use for your category and your area.', icon: 'pin', statuses: TEAM, plans: 'paid', free: 'locked' },
  { key: 'gbp', group: 'google', name: 'Google Business Profile setup and management', summary: 'Our team sets up your profile and keeps it up to date.', icon: 'store', statuses: TEAM, plans: 'paid', free: 'locked' },
  { key: 'analytics', group: 'google', name: 'Google Analytics and Search Console setup', summary: 'Our team connects both to your site so you can see how it is used.', icon: 'chart', statuses: TEAM, plans: 'paid', free: 'locked' },
  { key: 'merchant', group: 'google', name: 'Google Merchant profile listing', summary: 'Our team sets up your product listing in Google Merchant.', icon: 'store', statuses: TEAM, plans: 'ecommerce', free: 'locked' },
  // Content and reels
  { key: 'reels', group: 'content', name: 'Reels', summary: 'Short videos made for your business by our team and promoted to your subdomain only.', icon: 'video', statuses: ALLOW, plans: 'paid', free: 'locked', note: 'On the annual plan' },
  { key: 'poster', group: 'content', name: 'Poster', summary: 'A poster made for your business by our team and promoted to your subdomain only.', icon: 'image', statuses: ALLOW, plans: 'paid', free: 'locked', note: 'On the annual plan' },
  { key: 'posts', group: 'content', name: 'Posts', summary: 'Social posts written and designed by our team.', icon: 'share', statuses: ALLOW, plans: 'paid', free: 'locked' },
  { key: 'blogs', group: 'content', name: 'Blogs', summary: 'Articles for your site, written by our team and checked by you.', icon: 'file', statuses: ALLOW, plans: 'paid', free: 'locked' },
  { key: 'writing', group: 'content', name: 'Content writing', summary: 'The words of your pages, written for your business by our team.', icon: 'pen', statuses: ALLOW, plans: 'paid', free: 'locked' },
  // Campaigns and social
  { key: 'email', group: 'campaigns', name: 'Automated e-mail campaigns', summary: 'Send e-mail to your own customers from your business app.', icon: 'mail', statuses: SOON, plans: 'paid', free: 'locked' },
  { key: 'sms', group: 'campaigns', name: 'Automated SMS campaigns', summary: 'Send text messages to your own customers from your business app.', icon: 'phone', statuses: SOON, plans: 'paid', free: 'locked' },
  { key: 'whatsapp', group: 'campaigns', name: 'Automated WhatsApp campaigns', summary: 'Send WhatsApp messages to your own customers from your business app.', icon: 'chat', statuses: SOON, plans: 'paid', free: 'locked' },
  { key: 'social-posting', group: 'campaigns', name: 'Social posting to your accounts', summary: 'Publish to your own social accounts from your business app.', icon: 'share', statuses: SOON, plans: 'paid', free: 'locked' },
  // Custom domain add-on
  { key: 'cd-seo', group: 'addon', name: 'SEO for a custom domain', summary: 'Search work on a custom domain you connect, as an add-on pack.', icon: 'plus', statuses: ADDON, plans: 'paid', free: 'locked' },
  { key: 'cd-ads', group: 'addon', name: 'Paid ads for a custom domain', summary: 'Paid ads that point to a custom domain you connect, as an add-on pack.', icon: 'plus', statuses: ADDON, plans: 'paid', free: 'locked' },
];

/** The services of one group, in the order of the list above. */
export const servicesOf = (group: GrowthGroup): GrowthService[] => GROWTH_SERVICES.filter((s) => s.group === group);

/** The services that grow a business (everything except the base rows: the site and the tools themselves), for the home grid. */
export const GROWTH_ONLY: readonly GrowthService[] = GROWTH_SERVICES.filter((s) => !s.base);

/** The status labels of a service, one per status. */
export const statusLabels = (s: GrowthService): string[] => s.statuses.map((k) => GROWTH_STATUS_LABEL[k]);
