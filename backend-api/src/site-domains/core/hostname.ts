import { domainToASCII } from 'url';

/**
 * Pure host name rules (slice 5.6). No clock, no randomness, no network, no database. Everything here is total: odd input gives a refusal, never an exception.
 */

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const FORBIDDEN = /[\s\u0000-\u001f\u007f/\\@*?#%[\]()<>"'`;,=+!$&|^{}~]/;

/** The lowercase ASCII (punycode) form of a host name, or null when it is not an acceptable public host name (an IP address, localhost, a single label, a path, a wildcard...). */
export function normaliseHostname(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let h = input.trim();
  if (!h || h.length > 300) return null;
  h = h.replace(/:\d{1,5}$/, '').replace(/\.$/, '');
  if (!h || FORBIDDEN.test(h) || h.includes('_') || h.includes(':')) return null;
  const ascii = domainToASCII(h.toLowerCase());
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (labels.length < 2) return null;
  if (!labels.every((l) => LABEL.test(l))) return null;
  if (!TLD.test(labels[labels.length - 1])) return null;
  return ascii;
}

export interface SlugRules { min: number; max: number; reserved: string[]; blockedWords: string[] }
export type SlugProblem = 'TOO_SHORT' | 'TOO_LONG' | 'BAD_CHARACTERS' | 'BAD_EDGE' | 'CONSECUTIVE_HYPHENS' | 'RESERVED' | 'BLOCKED';
export type SlugResult = { ok: true; slug: string } | { ok: false; code: SlugProblem };

const FOLD: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', $: 's', '@': 'a' };

/** The look-alike key of a word: lowercase, separators removed, digits and symbols folded to the letters they imitate (1 is read as i). */
export function confusableKey(s: string): string { return confusableKeys(s)[0]; }

/** Both readings of the digit 1 (i and l), so "ma1l" and "mai1" are both caught. */
export function confusableKeys(s: string): string[] {
  const base = String(s ?? '').toLowerCase().replace(/[-.]/g, '').replace(/[03457$@]/g, (c) => FOLD[c] ?? c).replace(/ /g, '');
  return [...new Set([base.replace(/1/g, 'i'), base.replace(/1/g, 'l')])];
}

/** The free subdomain rules. The reserved and blocked lists come from editable settings; this function only applies them. */
export function validateSubdomainSlug(input: unknown, rules: SlugRules): SlugResult {
  if (typeof input !== 'string') return { ok: false, code: 'BAD_CHARACTERS' };
  const slug = input.trim().toLowerCase();
  if (slug.length < rules.min) return { ok: false, code: 'TOO_SHORT' };
  if (slug.length > rules.max) return { ok: false, code: 'TOO_LONG' };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, code: 'BAD_CHARACTERS' };
  if (slug.startsWith('-') || slug.endsWith('-')) return { ok: false, code: 'BAD_EDGE' };
  if (slug.includes('--')) return { ok: false, code: 'CONSECUTIVE_HYPHENS' };
  const keys = confusableKeys(slug);
  const reserved = new Set(rules.reserved.flatMap((r) => confusableKeys(r)));
  if (keys.some((k) => reserved.has(k))) return { ok: false, code: 'RESERVED' };
  const blocked = rules.blockedWords.flatMap((w) => confusableKeys(w)).filter((w) => w.length >= 3);
  if (keys.some((k) => blocked.some((w) => k.includes(w)))) return { ok: false, code: 'BLOCKED' };
  return { ok: true, slug };
}
