/**
 * B3.3 included services. The owner named six kinds of work a paid plan may include. Each is a GROUP of catalogue services. How many a plan includes, per billing term, is
 * a number only a SUPER_ADMIN sets. Until it is set the group is NOT_SET: nothing is included and no number is ever assumed.
 */
export const ALLOWANCE_TERMS: readonly number[] = [3, 6, 12];
export const MAX_ALLOWANCE = 100_000;

export interface IncludedGroup { key: string; name: string; /** catalogue services a unit of this group can be spent on; empty = no request flow yet */ serviceKeys: readonly string[] }
export const INCLUDED_GROUPS: readonly IncludedGroup[] = [
  { key: 'REELS', name: 'Reels', serviceKeys: ['REEL_SLIDESHOW', 'REEL_CORPORATE', 'REEL_CINEMATIC'] },
  { key: 'POSTERS', name: 'Posters', serviceKeys: ['POSTER_DESIGN'] },
  { key: 'POSTS', name: 'Posts', serviceKeys: ['POST_DESIGN'] },
  { key: 'BLOGS_CONTENT', name: 'Blogs and content writing', serviceKeys: ['BLOG_CREATOR_HIRE', 'CONTENT_CREATOR_HIRE'] },
  { key: 'SUBDOMAIN_SPOTLIGHT', name: 'Subdomain spotlight', serviceKeys: [] },
  { key: 'SEO_KEYWORD_WORK', name: 'SEO keyword work', serviceKeys: ['SEO_MANAGER_HIRE'] },
];

export const groupByKey = (key: string): IncludedGroup | undefined => INCLUDED_GROUPS.find((g) => g.key === key);
export const groupOfService = (serviceKey: string): IncludedGroup | undefined => INCLUDED_GROUPS.find((g) => g.serviceKeys.includes(serviceKey));

export type IncludedState = 'INCLUDED' | 'NOT_SET';
export interface IncludedView { state: IncludedState; group: string | null; limit: number | null; used: number; remaining: number | null }

/** limit = a quantity staff set (for this plan and term) or null. 'INCLUDED' only when a limit is set; a missing limit is never read as zero or as unlimited. */
export function includedView(group: string | null, limit: number | null, used: number): IncludedView {
  if (limit === null) return { state: 'NOT_SET', group, limit: null, used: 0, remaining: null };
  return { state: 'INCLUDED', group, limit, used, remaining: Math.max(0, limit - used) };
}

export function validateAllowance(termMonths: unknown, groupKey: unknown, quantity: unknown): string | null {
  if (typeof termMonths !== 'number' || !ALLOWANCE_TERMS.includes(termMonths)) return 'The billing term must be 3, 6 or 12 months.';
  if (typeof groupKey !== 'string' || !groupByKey(groupKey)) return `The service group must be one of ${INCLUDED_GROUPS.map((g) => g.key).join(', ')}.`;
  if (quantity !== null && !(typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_ALLOWANCE)) return `The quantity must be a whole number from 1 to ${MAX_ALLOWANCE}, or null to clear it (not set).`;
  return null;
}
