/**
 * What the site build and the staff SEO report may know about a vendor's DIRECTORY listing (prompt 6a, 6b, 8e): where it is (locality, city, pincode), the words its category is known by, and the
 * backlink block (a brand link and up to four directory links) as plain data. A read-only port, so site-publish never depends on the SEO module; implemented by the SEO module
 * (SeoVendorDirectoryFacts). A vendor with no listing in the directory is null: nothing is guessed. The vendor site has no service-area field of its own, so the listing's location is the one real source.
 */
export interface DirectoryLinksData { brand: { href: string; text: string }; links: Array<{ href: string; text: string }> }
export interface VendorDirectoryFacts {
  locality: string | null; city: string | null; pincode: string | null;
  /** the category's own words (name, singular, plural, staff synonyms), lower case, for the report's keyword check */
  keywords: string[];
  /** null while the listing is not listed or the directory pages are not indexable */
  directoryLinks: DirectoryLinksData | null;
}
export abstract class VendorDirectoryFactsPort {
  abstract forVendor(vendorId: string): Promise<VendorDirectoryFacts | null>;
  /** the same facts for many vendors (the staff report): no directory links, which the report does not need */
  abstract forVendors(vendorIds: readonly string[]): Promise<Map<string, Omit<VendorDirectoryFacts, 'directoryLinks'>>>;
}
