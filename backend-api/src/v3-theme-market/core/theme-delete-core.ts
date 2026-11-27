/**
 * Which uploaded themes may be deleted. PURE: no database, no Nest, no clock.
 *
 * A "theme" is its key with every stored version of it: vendor sites remember the key, not a row, so a delete removes all versions together or none. Only a theme that NEVER went live and is not, and
 * never was, a business's may be deleted (an old publication of a business can be restored, and it still needs the theme). Everything else is archived instead.
 */
export type ThemeDeleteBlock = 'PUBLISHED_BEFORE' | 'MADE_FOR_BUSINESS' | 'USED_BY_BUSINESS';

export const THEME_DELETE_BLOCK_MESSAGES: Readonly<Record<ThemeDeleteBlock, string>> = {
  PUBLISHED_BEFORE: 'This theme cannot be deleted because a version of it has been published. Archive it instead.',
  MADE_FOR_BUSINESS: 'This theme cannot be deleted because it was made for a business and is assigned to it. Archive it instead.',
  USED_BY_BUSINESS: 'This theme cannot be deleted because a business has it, or has had it, on its website or has bought it. Archive it instead.',
};

export interface ThemeDeleteFacts { status: string; publishedAt: Date | null; privateVendorId: string | null; sourceVendorId: string | null }

/** What the stored versions themselves say. null: nothing on them forbids it (whether a business uses the key still has to be asked). "Published" is answered first: it is the stronger reason. */
export function versionsDeleteBlock(versions: readonly ThemeDeleteFacts[]): ThemeDeleteBlock | null {
  if (versions.some((v) => v.status === 'PUBLISHED' || v.publishedAt !== null)) return 'PUBLISHED_BEFORE';
  if (versions.some((v) => v.privateVendorId !== null || v.sourceVendorId !== null)) return 'MADE_FOR_BUSINESS';
  return null;
}
