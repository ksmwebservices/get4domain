import { CATALOGUE_CATEGORIES } from '../directory/core/catalogue-categories';
import { KIT_ONLY_PACK } from '../directory/core/listable-categories';
import { formFor, RequestField } from './core/request-form-core';
import { REQUEST_FORM_DATA } from './core/request-form-data';

const PACK_OF = new Map<string, string>([...CATALOGUE_CATEGORIES.map((c) => [c.id, c.pack] as const), ...Object.entries(KIT_ONLY_PACK)]);

/** The industry pack of a registration category id (null when unknown). */
export const packOfIndustry = (industry: string | null | undefined): string | null => (industry ? PACK_OF.get(industry) ?? null : null);

/**
 * The extra request-form questions for a business, from its registration category (`Vendor.industry`). The page draws them and the server checks them with this same function, so the two
 * can never disagree. An unknown or missing category gets the default list.
 */
export function requestFormFor(industry: string | null | undefined): RequestField[] {
  return formFor(REQUEST_FORM_DATA, { pack: packOfIndustry(industry), category: industry ?? null });
}
