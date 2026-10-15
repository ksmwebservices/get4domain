import vocab from './design-vocab.json';
import { SITE_THEME_KEYS } from './site-doc.constants';

/**
 * Flow families. A category belongs to one family; the family decides the homepage section order, the navigation, what visitors do, what an item looks like
 * and the four design templates every category in the family starts with. Layout belongs to the flow, colours and fonts are shared.
 * A new category is never code: an admin picks a family and fills the starter content (see packs.service).
 */
export type FamilyKey = 'shop' | 'booking' | 'enquiry' | 'packages' | 'menu' | 'portfolio' | 'listings' | 'courses';
export type SectionType = keyof typeof vocab.sections;

export interface SectionSpec { type: SectionType; variant: string; enabled?: boolean }
export interface DesignSpec {
  key: string; name: string; enabled: boolean; themeKey: string;
  font: string; radius: string; button: string; nav: string; footer: string; actionBar: string;
  sections: SectionSpec[];
}

export const VOCAB = vocab as {
  sections: Record<SectionType, string[]>; fonts: string[]; radius: string[]; buttons: string[]; nav: string[]; footer: string[]; actionBar: string[]; families: FamilyKey[];
};

export interface FamilyDef {
  key: FamilyKey; label: string;
  /** what visitors do first: cart order request, booking or appointment form, enquiry form, site visit request, or call / WhatsApp */
  flow: 'cart' | 'booking' | 'enquiry' | 'site-visit' | 'call';
  goal: 'ENQUIRY' | 'BOOKING' | 'APPOINTMENT' | 'SITE_VISIT' | 'CART_ORDER';
  /** the page set within the free page limit (5): the home page carries these as anchored sections, extra pages are added by the vendor */
  pages: string[];
  /** navigation labels by section; a link is shown only when its section has something to show */
  nav: Partial<Record<SectionType, string>>;
  itemKind: 'product' | 'package' | 'service' | 'room' | 'treatment' | 'case' | 'listing';
  /** the variants of the items section that suit this family */
  itemVariants: string[];
  /** what the editor asks for on each item beyond name, description, price and picture (stored in the item's custom fields) */
  itemFields: { key: string; label: string }[];
  seoType: string;
  imageMood: string;
  imageSetSize: number;
  designs: { name: string; themeSlot: number; font: string; radius: string; button: string; nav: string; footer: string; actionBar: string; sections: string }[];
  /** four themes, one per design; slot 0 is replaced by the category's own theme */
  themes: string[];
}

/** "hero:split trust:icons ..." -> section specs. */
function spec(list: string): SectionSpec[] {
  return list.trim().split(/\s+/).map((p) => { const [type, variant] = p.split(':'); return { type: type as SectionType, variant }; });
}

export const FAMILIES: Record<FamilyKey, FamilyDef> = {
  shop: {
    key: 'shop', label: 'Shop and cart', flow: 'cart', goal: 'CART_ORDER', pages: ['Home', 'Products', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Products', about: 'About', gallery: 'Gallery', faq: 'Questions', enquiry: 'Contact' },
    itemKind: 'product', itemVariants: ['catalog-grid', 'catalog-list', 'catalog-compact', 'tiles', 'cards'], itemFields: [{ key: 'tags', label: 'Tags (comma separated)' }],
    seoType: 'Store', imageMood: 'bright product shots on a clean ground', imageSetSize: 5, themes: ['bold-violet', 'midnight-gold', 'clean-teal', 'sunset-orange'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'sans', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:split trust:icons items:catalog-grid about:split testimonials:cards faq:accordion enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:overlay items:catalog-compact trust:pills gallery:mosaic process:cards testimonials:quote faq:columns enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'classic', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:catalog-list about:centered process:line faq:accordion hours:strip enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'announce:strip hero:card trust:divided items:tiles gallery:grid about:columns testimonials:list hours:card faq:cards enquiry:panel contact:card cta:band' },
    ],
  },
  booking: {
    key: 'booking', label: 'Booking and appointment', flow: 'booking', goal: 'APPOINTMENT', pages: ['Home', 'Services', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Services', about: 'About', team: 'Team', gallery: 'Gallery', faq: 'Questions', enquiry: 'Book' },
    itemKind: 'service', itemVariants: ['cards', 'rows', 'menu', 'tiles'], itemFields: [{ key: 'duration', label: 'How long it takes' }],
    seoType: 'LocalBusiness', imageMood: 'calm, clean interiors and hands at work', imageSetSize: 4, themes: ['clean-teal', 'ocean-dark', 'soft-rose', 'warm-sand'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'sans', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:split trust:icons items:cards process:cards about:split team:cards testimonials:cards faq:accordion hours:card enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:overlay items:tiles stats:band process:timeline gallery:strip testimonials:quote enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'classic', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:menu about:centered beforeAfter:pair process:line faq:columns hours:table enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'announce:strip hero:card trust:pills items:rows beforeAfter:slider gallery:mosaic team:circles testimonials:list faq:cards enquiry:panel contact:card' },
    ],
  },
  enquiry: {
    key: 'enquiry', label: 'Enquiry and services', flow: 'enquiry', goal: 'ENQUIRY', pages: ['Home', 'Services', 'About', 'Work', 'Contact'],
    nav: { items: 'Services', about: 'About', team: 'Team', pricing: 'Pricing', gallery: 'Work', faq: 'Questions', enquiry: 'Contact' },
    itemKind: 'service', itemVariants: ['cards', 'rows', 'tiles', 'index'], itemFields: [],
    seoType: 'ProfessionalService', imageMood: 'confident, tidy workspaces and teams at work', imageSetSize: 4, themes: ['classic-blue', 'plum-night', 'clean-teal', 'harbour-amber'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'classic', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:split trust:divided items:index process:cards about:columns stats:cards testimonials:cards faq:accordion cta:band enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:panel items:tiles pricing:cards process:timeline team:cards gallery:grid testimonials:quote faq:columns enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'sans', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:rows about:centered process:line pricing:table faq:accordion enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'hero:overlay trust:pills items:cards about:split team:circles testimonials:list hours:card faq:cards cta:card enquiry:panel contact:card' },
    ],
  },
  packages: {
    key: 'packages', label: 'Packages and tours', flow: 'enquiry', goal: 'ENQUIRY', pages: ['Home', 'Packages', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Packages', about: 'About', gallery: 'Gallery', faq: 'Questions', enquiry: 'Plan with us' },
    itemKind: 'package', itemVariants: ['package-cards', 'package-featured', 'package-horizontal', 'tiles'], itemFields: [{ key: 'duration', label: 'Duration (for example 3 days)' }, { key: 'includes', label: 'What is included' }],
    seoType: 'TravelAgency', imageMood: 'wide landscapes, people enjoying a place, golden light', imageSetSize: 5, themes: ['warm-sand', 'ocean-dark', 'sunset-orange', 'fresh-green'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'classic', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:overlay trust:icons items:package-cards process:timeline gallery:mosaic about:split testimonials:cards faq:accordion enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:split items:package-featured stats:band gallery:strip testimonials:quote faq:columns enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'sans', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:package-horizontal about:centered process:line faq:accordion hours:strip enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'announce:strip hero:card trust:divided items:tiles about:columns gallery:grid team:circles testimonials:list faq:cards cta:band enquiry:panel contact:card' },
    ],
  },
  menu: {
    key: 'menu', label: 'Menu and orders', flow: 'booking', goal: 'BOOKING', pages: ['Home', 'Menu', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Menu', about: 'About', gallery: 'Gallery', hours: 'Hours', faq: 'Questions', enquiry: 'Reserve' },
    itemKind: 'product', itemVariants: ['menu-twocol', 'menu-tabs', 'menu-photo', 'cards', 'tiles'], itemFields: [{ key: 'veg', label: 'Veg, non-veg or egg' }],
    seoType: 'Restaurant', imageMood: 'warm, appetising food close-ups and a welcoming table', imageSetSize: 5, themes: ['warm-sand', 'midnight-gold', 'street-orange', 'fresh-green'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'classic', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:overlay trust:icons items:menu-twocol about:split gallery:mosaic testimonials:cards hours:card faq:accordion enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:split items:menu-photo gallery:strip process:cards testimonials:quote enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'sans', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:menu-tabs about:centered hours:table faq:columns enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'announce:strip hero:card trust:pills items:cards about:columns gallery:grid testimonials:list hours:strip faq:cards cta:band enquiry:panel contact:card' },
    ],
  },
  portfolio: {
    key: 'portfolio', label: 'Portfolio and gallery', flow: 'enquiry', goal: 'ENQUIRY', pages: ['Home', 'Work', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Work', gallery: 'Gallery', about: 'About', beforeAfter: 'Before and after', faq: 'Questions', enquiry: 'Contact' },
    itemKind: 'case', itemVariants: ['tiles', 'rows', 'cards'], itemFields: [{ key: 'location', label: 'Where it was done' }, { key: 'year', label: 'Year' }],
    seoType: 'LocalBusiness', imageMood: 'finished work shown large, natural light, little text', imageSetSize: 6, themes: ['midnight-gold', 'clean-teal', 'plum-night', 'soft-rose'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'classic', radius: 'sharp', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:split items:tiles about:split process:cards gallery:mosaic testimonials:cards faq:accordion enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'hero:overlay items:rows stats:band beforeAfter:slider process:timeline testimonials:quote enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'sans', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center gallery:grid items:cards about:centered faq:columns enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'announce:strip hero:card items:cards trust:pills about:columns gallery:strip beforeAfter:pair team:circles testimonials:list cta:band enquiry:panel contact:card' },
    ],
  },
  listings: {
    key: 'listings', label: 'Listings', flow: 'site-visit', goal: 'SITE_VISIT', pages: ['Home', 'Properties', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Properties', about: 'About', team: 'Team', gallery: 'Gallery', faq: 'Questions', enquiry: 'Site visit' },
    itemKind: 'listing', itemVariants: ['cards', 'rows', 'tiles'], itemFields: [{ key: 'bedrooms', label: 'Bedrooms' }, { key: 'area', label: 'Area' }, { key: 'location', label: 'Location' }],
    seoType: 'RealEstateAgent', imageMood: 'bright building exteriors and tidy rooms', imageSetSize: 5, themes: ['classic-blue', 'midnight-gold', 'fresh-green', 'warm-sand'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'classic', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:card trust:icons items:cards about:split process:cards testimonials:cards faq:accordion enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:overlay items:rows stats:band gallery:mosaic team:cards testimonials:quote enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'sans', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:tiles about:centered process:line faq:columns enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'hero:split trust:pills items:cards gallery:grid about:columns team:circles testimonials:list faq:cards cta:band enquiry:panel contact:card' },
    ],
  },
  courses: {
    key: 'courses', label: 'Courses and classes', flow: 'booking', goal: 'BOOKING', pages: ['Home', 'Courses', 'About', 'Gallery', 'Contact'],
    nav: { items: 'Courses', about: 'About', team: 'Teachers', pricing: 'Fees', gallery: 'Gallery', faq: 'Questions', enquiry: 'Enquire' },
    itemKind: 'service', itemVariants: ['cards', 'rows', 'tiles', 'index'], itemFields: [{ key: 'duration', label: 'Duration' }, { key: 'mode', label: 'Mode (classroom, online)' }, { key: 'level', label: 'Level or class' }],
    seoType: 'EducationalOrganization', imageMood: 'bright classrooms and learners at work', imageSetSize: 4, themes: ['classic-blue', 'forest-night', 'bold-violet', 'sunset-orange'],
    designs: [
      { name: 'Classic', themeSlot: 0, font: 'classic', radius: 'soft', button: 'solid', nav: 'bar', footer: 'columns', actionBar: 'tabs', sections: 'hero:split trust:icons items:cards process:cards team:cards about:split testimonials:cards faq:accordion enquiry:panel contact:card' },
      { name: 'Bold', themeSlot: 1, font: 'sans', radius: 'sharp', button: 'solid', nav: 'centered', footer: 'centered', actionBar: 'cta', sections: 'announce:accent hero:panel items:tiles stats:band pricing:cards process:timeline testimonials:quote faq:columns enquiry:split contact:split' },
      { name: 'Minimal', themeSlot: 2, font: 'sans', radius: 'soft', button: 'outline', nav: 'minimal', footer: 'minimal', actionBar: 'split', sections: 'hero:center items:rows about:centered process:line pricing:table faq:accordion enquiry:card contact:minimal' },
      { name: 'Warm', themeSlot: 3, font: 'humanist', radius: 'round', button: 'pill', nav: 'bar', footer: 'columns', actionBar: 'cta', sections: 'announce:strip hero:overlay trust:divided items:index gallery:grid team:circles testimonials:list hours:card faq:cards cta:band enquiry:panel contact:card' },
    ],
  },
};

export const FAMILY_KEYS = Object.keys(FAMILIES) as FamilyKey[];

/** Four different themes for a category: the family's palette with the category's own theme in the first slot, never the same theme twice. */
export function themesFor(family: FamilyKey, base: string): string[] {
  const palette = FAMILIES[family].themes;
  const out = [base];
  for (let i = 1; i < 4; i++) {
    const pick = [palette[i], ...palette, ...SITE_THEME_KEYS].find((t) => t && !out.includes(t));
    out.push(pick as string);
  }
  return out;
}

/** The four designs of a category: the family's templates with the category's four themes. */
export function designsFor(family: FamilyKey, base: string): DesignSpec[] {
  const f = FAMILIES[family];
  const themes = themesFor(family, base);
  return f.designs.map((d) => ({
    key: d.name.toLowerCase(), name: d.name, enabled: true, themeKey: themes[d.themeSlot] ?? themes[0],
    font: d.font, radius: d.radius, button: d.button, nav: d.nav, footer: d.footer, actionBar: d.actionBar, sections: spec(d.sections),
  }));
}

/** Plain-sentence problems with a design (empty = fine). */
export function validateDesign(d: unknown, family: FamilyKey): string[] {
  const p: string[] = [];
  const o = (d && typeof d === 'object' ? d : {}) as Partial<DesignSpec>;
  const name = String(o.name ?? o.key ?? 'A design');
  if (!o.key || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.key)) p.push(`${name}: the design key can only use lower-case letters, numbers and dashes.`);
  if (!o.name || String(o.name).length > 30) p.push(`${name}: give the design a name of up to 30 characters.`);
  if (!(SITE_THEME_KEYS as readonly string[]).includes(String(o.themeKey))) p.push(`${name}: choose one of the listed themes.`);
  for (const [k, list] of [['font', VOCAB.fonts], ['radius', VOCAB.radius], ['button', VOCAB.buttons], ['nav', VOCAB.nav], ['footer', VOCAB.footer], ['actionBar', VOCAB.actionBar]] as [keyof DesignSpec, string[]][]) {
    if (!list.includes(String(o[k]))) p.push(`${name}: choose ${k} from ${list.join(', ')}.`);
  }
  if (!Array.isArray(o.sections) || o.sections.length < 3) p.push(`${name}: a design needs at least three sections.`);
  else {
    const types = o.sections.map((s) => s?.type);
    if (!types.includes('hero')) p.push(`${name}: a design needs a top section (hero).`);
    if (!types.includes('enquiry')) p.push(`${name}: a design needs the enquiry section, so visitors can reach the business.`);
    for (const s of o.sections) {
      const allowed = VOCAB.sections[s?.type as SectionType];
      if (!allowed) { p.push(`${name}: "${String(s?.type)}" is not a section type.`); continue; }
      if (!allowed.includes(String(s.variant))) p.push(`${name}: choose a ${s.type} layout from ${allowed.join(', ')}.`);
      if (s.type === 'items' && !FAMILIES[family].itemVariants.includes(s.variant)) p.push(`${name}: the items layout "${s.variant}" does not suit this kind of business. Choose from ${FAMILIES[family].itemVariants.join(', ')}.`);
    }
  }
  return p;
}
