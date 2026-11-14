/**
 * The page templates (SEO block slice 1c). One entry per page type; each of title, description and h1 is an ORDERED list of candidates, longest first: the first one whose
 * placeholders all have a value and that fits is used, so a page with no locality falls back to the city form and a long vendor name falls back to a shorter one.
 * The brand suffix (" | Get4Domain") and the " - Page N" marker are added by buildTitle, not written here. Staff edit these as data; these are the defaults.
 * Text rules: no price, no rating, no offer, no promise of a result, and nothing that states a fact the page data does not hold.
 */
export const SEO_PAGE_TYPES = ['home', 'state', 'city', 'category', 'cityCategory', 'localityCategory', 'pincodeCategory', 'business', 'vendorHome', 'vendorPage'] as const;
export type SeoPageType = (typeof SEO_PAGE_TYPES)[number];

export interface PageTemplate { title: string[]; description: string[]; h1: string[] }
export type SeoTemplates = Record<SeoPageType, PageTemplate>;

const LIST = 'addresses, services and websites';
export const DEFAULT_SEO_TEMPLATES: Readonly<SeoTemplates> = {
  home: {
    title: ['Local Business Directory and Websites in India', 'Local Business Directory'],
    description: ['Find local businesses, addresses, services and websites by city and category on Get4Domain. Browse the directory at get4domain.com.', 'Find local businesses, addresses, services and websites on Get4Domain at get4domain.com.'],
    h1: ['Find local businesses and their websites'],
  },
  state: {
    title: ['Businesses in {state}'],
    description: [`Find {count} businesses in {state}: ${LIST} on get4domain.com.`, `Find businesses in {state}: ${LIST} on get4domain.com.`, `Businesses in {state}: ${LIST}.`],
    h1: ['Businesses in {state}'],
  },
  city: {
    title: ['Businesses in {city}', '{city} Business Directory'],
    description: [`Find {count} businesses in {city}: ${LIST} on get4domain.com.`, `Find businesses in {city}: ${LIST} on get4domain.com.`, `Businesses in {city}: ${LIST}.`],
    h1: ['Businesses in {city}'],
  },
  category: {
    title: ['{categoryPlural} Near You', '{categoryPlural}'],
    description: [`Find {count} {categoryPlural}: ${LIST} on get4domain.com.`, `Find {categoryPlural}: ${LIST} on get4domain.com.`, `{categoryPlural}: ${LIST}.`],
    h1: ['{categoryPlural}'],
  },
  cityCategory: {
    title: ['{categoryPlural} in {city}'],
    description: [`Find {count} {categoryPlural} in {city}: ${LIST} on get4domain.com.`, `Find {count} {categoryPlural} in {city}: ${LIST}.`, `{categoryPlural} in {city}: ${LIST}.`],
    h1: ['{categoryPlural} in {city}'],
  },
  localityCategory: {
    title: ['{categoryPlural} in {locality}, {city}', '{categoryPlural} in {locality}', '{categoryPlural} in {city}'],
    description: [`Find {count} {categoryPlural} in {locality}, {city}: ${LIST}.`, `Find {count} {categoryPlural} in {locality}: ${LIST}.`, `{categoryPlural} in {locality}, {city}: ${LIST}.`, `{categoryPlural} in {city}: ${LIST}.`],
    h1: ['{categoryPlural} in {locality}, {city}', '{categoryPlural} in {city}'],
  },
  pincodeCategory: {
    title: ['{categoryPlural} in {pincode}, {city}', '{categoryPlural} in {pincode}'],
    description: [`Find {count} {categoryPlural} in {pincode}, {city}: ${LIST}.`, `Find {count} {categoryPlural} in {pincode}: ${LIST}.`, `{categoryPlural} in {pincode}: ${LIST}.`],
    h1: ['{categoryPlural} in {pincode}, {city}', '{categoryPlural} in {pincode}'],
  },
  business: {
    title: ['{vendorName} | {category} in {locality}, {city}', '{vendorName} | {category} in {city}', '{vendorName} | {category}', '{vendorName}'],
    description: ['{vendorName}: {category} in {locality}, {city}. Address, services and website on get4domain.com.', '{vendorName}: {category} in {city}. Address, services and website on get4domain.com.', '{vendorName}: {category}. Address, services and website on get4domain.com.'],
    h1: ['{vendorName}'],
  },
  vendorHome: {
    title: ['{vendorName} | {category} in {locality}, {city}', '{vendorName} | {category} in {city}', '{vendorName} | {category}', '{vendorName}'],
    description: ['{vendorName}, {category} in {locality}, {city}. Read about the business and the services it offers.', '{vendorName}, {category} in {city}. Read about the business and the services it offers.', '{vendorName}, {category}. Read about the business and the services it offers.'],
    h1: ['{vendorName}'],
  },
  vendorPage: {
    title: ['{pageName} | {vendorName}, {category} in {locality}', '{pageName} | {vendorName}, {category} in {city}', '{pageName} | {vendorName}, {category}', '{pageName} | {vendorName}'],
    description: ['{pageName} of {vendorName}, {category} in {locality}, {city}.', '{pageName} of {vendorName}, {category} in {city}.', '{pageName} of {vendorName}.'],
    h1: ['{pageName}'],
  },
};
