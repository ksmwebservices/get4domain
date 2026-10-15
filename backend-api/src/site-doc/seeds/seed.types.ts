import type { FamilyKey } from '../families';

/** [title, description, sample price in rupees ('' = none), category, extra fields] */
export type SeedItem = [string, string, string, string, Record<string, string>?];

/**
 * The starter content of one category. Everything here is SAMPLE: it is copied into a new vendor's own site, marked sample, editable, and the public page hides
 * sample prices and sample customer quotes until the vendor edits them. {business}, {city} and {phone} are filled from the vendor's company details.
 * No statistic, award, certificate or named person is ever invented here.
 */
export interface CategorySeed {
  key: string; name: string; family: FamilyKey;
  /** other words that identify this category (LeadSpace trade ids and everyday names) */
  aliases: string[];
  theme: string; seoType: string; cta: string;
  itemNoun: string; itemNounPlural: string;
  /** the icon the starter pictures are drawn around (a lucide icon name) and a hue 0 to 360 */
  motif: string; hue: number;
  tagline: string; headline: string; subline: string; about: string; announce: string;
  items: SeedItem[];
  faq: [string, string][];
  quotes: [string, string][];
  trust?: string[];
  steps?: [string, string][];
}
