/**
 * The Google review link (slice B3, amendment 08), pure. The vendor enters it; a Pro site shows the kit's "Write a review on Google" button that opens it; a Free site shows nothing (owner rule 2).
 * Nothing is ever posted to Google by us. https only, on a short allow-list of hosts: google.com (and its subdomains), g.page, maps.app.goo.gl and search.google.com.
 */
export const REVIEW_LINK_HOSTS: readonly string[] = ['google.com', 'g.page', 'maps.app.goo.gl', 'search.google.com'];
export const REVIEW_LINK_MAX = 500;

export type ReviewLinkFail = { ok: false; code: 'FIELD_INVALID' | 'REVIEW_HOST_NOT_ALLOWED'; message: string };
const fail = (code: ReviewLinkFail['code'], message: string): ReviewLinkFail => ({ ok: false, code, message });

/** An empty value clears the link. */
export function validateReviewUrl(input: unknown): { ok: true; url: string } | ReviewLinkFail {
  if (typeof input !== 'string') return fail('FIELD_INVALID', 'Paste the link as text.');
  const v = input.trim();
  if (v === '') return { ok: true, url: '' };
  if (v.length > REVIEW_LINK_MAX || /\s/.test(v)) return fail('FIELD_INVALID', 'Paste one full link.');
  let u: URL;
  try { u = new URL(v); } catch { return fail('FIELD_INVALID', 'Paste the full link, starting with https://.'); }
  if (u.protocol !== 'https:') return fail('FIELD_INVALID', 'The link must start with https://.');
  if (u.username || u.password || u.port) return fail('FIELD_INVALID', 'That link has parts that are not allowed.');
  const host = u.hostname.toLowerCase();
  // the host is an allowed name exactly, or a subdomain of google.com (maps.google.com, www.google.com); nothing else, so look-alikes such as google.com.evil.test never pass
  const ok = REVIEW_LINK_HOSTS.some((h) => host === h) || host.endsWith('.google.com');
  if (!ok) return fail('REVIEW_HOST_NOT_ALLOWED', 'That is not a Google link. Use the link Google gives you for reviews.');
  return { ok: true, url: v };
}
