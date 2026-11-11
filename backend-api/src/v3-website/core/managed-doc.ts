import { RESERVED_PAGE_SLUGS } from '../../site-publish/content/content-adapter';
import { SourceCms, SourceDocument, SourceExtras } from '../../site-publish/content/content-types';
import { sha256, stableJson } from '../../site-publish/publish/site-config';
import { buildDirectionsUrl, composeAddress, Location, parseMapLink, validateLocation } from './location-core';
import { validateReviewUrl } from './review-link-core';
import { TESTIMONIAL_LABEL, Testimonial, validateTestimonials } from './testimonial-core';
import { isPageKey, PageSeoEdit, validatePageSeo } from './seo-core';

/**
 * The managed content document (slice 5.5a), pure. It holds ONLY what a vendor wrote in the Website manager, as typed fields: anything not in it falls back to the
 * legacy site document (read through the content source). It is applied OVER the source document (`applyToSource`), so the renderer mapping is unchanged.
 *
 * What is NOT here, by design: the business name (identity changes go through the directory and staff routes), services and products (they are the vendor's Offerings
 * or Catalogue, single source), and every SEO, canonical, structured-data and hreflang value (the platform generates them; a vendor write to those keys is FIELD_LOCKED).
 *
 * Length figures below are payload-validation sizes for the text a page can hold, not business limits. Business limits (pages, gallery, FAQs) come from the plan features.
 */
export const MANAGED_DOC_VERSION = 1;
/** a payload-safety ceiling on any list, the same as the content source's item ceiling; plan limits are applied separately from the entitlements */
export const LIST_PAYLOAD_CEILING = 200;

export type FieldType = 'text' | 'longtext' | 'url' | 'image' | 'phone' | 'email';
export interface FieldDef { type: FieldType; max: number; label: string; proOnly?: boolean }

export const FIELD_DEFS: Readonly<Record<string, FieldDef>> = {
  'site.tagline': { type: 'text', max: 120, label: 'Tagline' },
  'hero.title': { type: 'text', max: 120, label: 'Headline' },
  'hero.subtitle': { type: 'text', max: 240, label: 'Sub-headline' },
  'hero.badge': { type: 'text', max: 60, label: 'Announcement' },
  'hero.image': { type: 'image', max: 500, label: 'Banner image' },
  'hero.imageAlt': { type: 'text', max: 160, label: 'Banner image description' },
  'about.text': { type: 'longtext', max: 4000, label: 'About text' },
  'about.image': { type: 'image', max: 500, label: 'About image' },
  'about.imageAlt': { type: 'text', max: 160, label: 'About image description' },
  'cta.label': { type: 'text', max: 40, label: 'Button wording', proOnly: true },
  'contact.phone': { type: 'phone', max: 24, label: 'Phone' },
  'contact.email': { type: 'email', max: 120, label: 'Email' },
  'contact.whatsapp': { type: 'phone', max: 24, label: 'WhatsApp number' },
  'contact.address': { type: 'text', max: 300, label: 'Address' },
  'social.instagram': { type: 'url', max: 300, label: 'Instagram link' },
  'social.facebook': { type: 'url', max: 300, label: 'Facebook link' },
  'social.youtube': { type: 'url', max: 300, label: 'YouTube link' },
  'social.linkedin': { type: 'url', max: 300, label: 'LinkedIn link' },
  'social.x': { type: 'url', max: 300, label: 'X link' },
  'social.custom': { type: 'url', max: 300, label: 'Your own link' },
  'social.customLabel': { type: 'text', max: 40, label: 'Your own link label' },
};

export interface ListFieldDef { type: FieldType; max: number; required?: boolean }
export interface ListDef { label: string; fields: Readonly<Record<string, ListFieldDef>> }
export type ListName = 'faqs' | 'gallery' | 'steps' | 'trust' | 'stats' | 'team' | 'credentials' | 'pages';
export const LIST_DEFS: Readonly<Record<ListName, ListDef>> = {
  faqs: { label: 'Questions and answers', fields: { q: { type: 'text', max: 200, required: true }, a: { type: 'longtext', max: 1500, required: true } } },
  gallery: { label: 'Gallery', fields: { src: { type: 'image', max: 500, required: true }, alt: { type: 'text', max: 160, required: true }, title: { type: 'text', max: 120 } } },
  steps: { label: 'How we work', fields: { title: { type: 'text', max: 80, required: true }, desc: { type: 'text', max: 300 } } },
  trust: { label: 'Why choose us', fields: { text: { type: 'text', max: 120, required: true } } },
  stats: { label: 'Numbers', fields: { value: { type: 'text', max: 20, required: true }, label: { type: 'text', max: 60, required: true } } },
  team: { label: 'Team', fields: { name: { type: 'text', max: 80, required: true }, role: { type: 'text', max: 80 }, note: { type: 'text', max: 200 }, image: { type: 'image', max: 500 } } },
  credentials: { label: 'Credentials', fields: { title: { type: 'text', max: 80, required: true }, detail: { type: 'text', max: 200 } } },
  pages: { label: 'Extra pages', fields: { slug: { type: 'text', max: 48, required: true }, title: { type: 'text', max: 120, required: true }, intro: { type: 'text', max: 300 }, body: { type: 'longtext', max: 8000, required: true } } },
};
/** the plan feature that limits a list, where the plan has one (the others use the payload ceiling only) */
export const LIST_PLAN_FEATURE: Readonly<Partial<Record<ListName, string>>> = { faqs: 'site.faqs', gallery: 'site.gallery', pages: 'site.pages' };

export type ListItem = Record<string, string | boolean>;
export interface NavItem { key: string; label: string; visible: boolean }
export interface NavigationDoc { header: NavItem[]; footer: NavItem[] }
export interface BrandDoc { accent?: string; accentDark?: string; fontHeading?: string; fontBody?: string; logo?: string }
export interface SectionsDoc { hidden: string[]; order: string[] }
export interface ManagedDoc {
  v: typeof MANAGED_DOC_VERSION;
  fields: Record<string, string>;
  lists: Partial<Record<ListName, ListItem[]>>;
  sections: SectionsDoc;
  brand: BrandDoc;
  navigation: NavigationDoc;
  /** slice B1: the vendor's own SEO text per page (a page key such as home or page:warranty); a page with no entry shows the platform default */
  seo: Record<string, PageSeoEdit>;
  /** slice B2: the business's address lines, city, state, pincode, optional coordinates and the pasted map link; absent = the legacy address text is used */
  location?: Location;
  /** slice B3: the Google review link the vendor entered (Pro sites show the Write a review button; Free sites show nothing); absent = none */
  reviewUrl?: string;
  /** slice B4: testimonials the vendor chose to show (Pro only); absent = the older legacy list is used */
  testimonials?: Testimonial[];
}

export const emptyDoc = (): ManagedDoc => ({ v: MANAGED_DOC_VERSION, fields: {}, lists: {}, sections: { hidden: [], order: [] }, brand: {}, navigation: { header: [], footer: [] }, seo: {} });

/** A copy of a stored document with every part present (older rows, or a partial patch, never break a reader). */
export function normaliseDoc(raw: unknown): ManagedDoc {
  const d = emptyDoc();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const r = raw as Partial<ManagedDoc>;
  return {
    v: MANAGED_DOC_VERSION,
    fields: r.fields && typeof r.fields === 'object' && !Array.isArray(r.fields) ? { ...r.fields } : d.fields,
    lists: r.lists && typeof r.lists === 'object' && !Array.isArray(r.lists) ? { ...r.lists } : d.lists,
    sections: { hidden: Array.isArray(r.sections?.hidden) ? [...r.sections.hidden] : [], order: Array.isArray(r.sections?.order) ? [...r.sections.order] : [] },
    brand: r.brand && typeof r.brand === 'object' && !Array.isArray(r.brand) ? { ...r.brand } : {},
    navigation: { header: Array.isArray(r.navigation?.header) ? [...r.navigation.header] : [], footer: Array.isArray(r.navigation?.footer) ? [...r.navigation.footer] : [] },
    seo: r.seo && typeof r.seo === 'object' && !Array.isArray(r.seo) ? { ...r.seo } : {},
    ...(r.location && typeof r.location === 'object' && !Array.isArray(r.location) ? { location: { ...r.location } } : {}),
    ...(typeof r.reviewUrl === 'string' && r.reviewUrl ? { reviewUrl: r.reviewUrl } : {}),
    ...(Array.isArray(r.testimonials) ? { testimonials: r.testimonials.map((t) => ({ ...t })) } : {}),
  };
}

export type Fail = { ok: false; code: string; message: string; field?: string };
export type Ok<T> = { ok: true } & T;
const fail = (code: string, message: string, field?: string): Fail => ({ ok: false, code, message, ...(field ? { field } : {}) });
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MARKUP = /[<>]/;
const PHONE = /^\+?[0-9][0-9 ()-]*$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

function httpsUrl(v: string, max: number): boolean {
  if (v.length > max || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.');
  } catch { return false; }
}

/** One typed value, cleaned (trimmed). Returns the clean string or a failure. */
export function cleanValue(type: FieldType, max: number, value: unknown, field: string): { ok: true; value: string } | Fail {
  if (typeof value !== 'string') return fail('FIELD_INVALID', 'That value must be text.', field);
  const v = type === 'longtext' ? value.replace(/\r\n/g, '\n').trim() : value.trim();
  if (v.length > max) return fail('FIELD_INVALID', `That text is longer than ${max} characters.`, field);
  if (CONTROL.test(v) || (type !== 'longtext' && /[\r\n]/.test(v))) return fail('FIELD_INVALID', 'That text has characters that are not allowed.', field);
  if (v === '') return { ok: true, value: '' };
  switch (type) {
    case 'text': case 'longtext': if (MARKUP.test(v)) return fail('FIELD_INVALID', 'Remove the < and > characters; page text is plain text.', field); break;
    case 'url': case 'image': if (!httpsUrl(v, max)) return fail('FIELD_INVALID', 'Enter a full link that starts with https://.', field); break;
    case 'phone': { const digits = v.replace(/\D/g, ''); if (!PHONE.test(v) || digits.length < 7 || digits.length > 15) return fail('FIELD_INVALID', 'Enter a phone number with digits only (a leading + is fine).', field); break; }
    case 'email': if (!EMAIL.test(v)) return fail('FIELD_INVALID', 'Enter a valid email address.', field); break;
  }
  return { ok: true, value: v };
}

/** Set one editable field. An empty value removes the override (the legacy text shows again). */
export function writeField(doc: ManagedDoc, key: string, value: unknown): Ok<{ doc: ManagedDoc }> | Fail {
  if (!has(FIELD_DEFS, key)) return fail('FIELD_LOCKED', 'That field is not editable.', key);
  const def = FIELD_DEFS[key];
  const c = cleanValue(def.type, def.max, value, key);
  if (!c.ok) return c;
  const fields = { ...doc.fields };
  if (c.value === '') delete fields[key]; else fields[key] = c.value;
  return { ok: true, doc: { ...doc, fields } };
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateList(name: ListName, items: unknown): Ok<{ items: ListItem[] }> | Fail {
  if (!has(LIST_DEFS, name)) return fail('FIELD_LOCKED', 'That list is not editable.', String(name));
  if (!Array.isArray(items)) return fail('FIELD_INVALID', 'A list must be an array.', name);
  if (items.length > LIST_PAYLOAD_CEILING) return fail('LIST_TOO_LONG', 'That list is too long.', name);
  const def = LIST_DEFS[name];
  const out: ListItem[] = []; const slugs = new Set<string>();
  for (const [i, raw] of items.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('FIELD_INVALID', 'Each item must be an object.', `${name}[${i}]`);
    const item = raw as Record<string, unknown>;
    const allowed = name === 'pages' ? [...Object.keys(def.fields), 'enabled'] : Object.keys(def.fields);
    for (const k of Object.keys(item)) if (!allowed.includes(k)) return fail('FIELD_INVALID', `${k} is not a field of this list.`, `${name}[${i}].${k}`);
    const clean: ListItem = {};
    for (const [fk, fd] of Object.entries(def.fields)) {
      const present = has(item, fk) && item[fk] !== undefined && item[fk] !== null;
      if (!present) { if (fd.required) return fail(name === 'gallery' && fk === 'alt' ? 'ALT_REQUIRED' : fk === 'slug' ? 'SLUG_INVALID' : 'FIELD_INVALID', `${fk} is required.`, `${name}[${i}].${fk}`); clean[fk] = ''; continue; }
      const c = cleanValue(fd.type, fd.max, item[fk], `${name}[${i}].${fk}`);
      if (!c.ok) return c;
      if (fd.required && c.value === '') return fail(name === 'gallery' && fk === 'alt' ? 'ALT_REQUIRED' : fk === 'slug' ? 'SLUG_INVALID' : 'FIELD_INVALID', `${fk} is required.`, `${name}[${i}].${fk}`);
      clean[fk] = c.value;
    }
    if (name === 'pages') {
      const slug = String(clean.slug);
      if (!SLUG.test(slug) || RESERVED_PAGE_SLUGS.has(slug) || slugs.has(slug)) return fail('SLUG_INVALID', 'Use lower-case letters, digits and hyphens; the name must be unused and not reserved.', `pages[${i}].slug`);
      slugs.add(slug);
      if (has(item, 'enabled') && typeof item.enabled !== 'boolean') return fail('FIELD_INVALID', 'enabled must be true or false.', `pages[${i}].enabled`);
      clean.enabled = has(item, 'enabled') ? (item.enabled as boolean) : true;
    }
    out.push(clean);
  }
  return { ok: true, items: out };
}

export function writeList(doc: ManagedDoc, name: ListName, items: unknown): Ok<{ doc: ManagedDoc }> | Fail {
  const r = validateList(name, items);
  if (!r.ok) return r;
  return { ok: true, doc: { ...doc, lists: { ...doc.lists, [name]: r.items } } };
}

/** The hero can never be hidden; every named section must exist on the theme. */
export function validateSections(input: unknown, knownIds: readonly string[]): Ok<{ sections: SectionsDoc }> | Fail {
  const i = input as Partial<SectionsDoc> | null;
  if (!i || typeof i !== 'object' || !Array.isArray(i.hidden) || !Array.isArray(i.order)) return fail('FIELD_INVALID', 'Send hidden and order as lists.', 'sections');
  const ids = (l: unknown[]): string[] | null => (l.every((x) => typeof x === 'string') ? (l as string[]) : null);
  const hidden = ids(i.hidden); const order = ids(i.order);
  if (!hidden || !order) return fail('FIELD_INVALID', 'Section names must be text.', 'sections');
  if (hidden.includes('hero')) return fail('SECTION_REQUIRED', 'The top banner cannot be hidden.', 'sections.hidden');
  for (const s of [...hidden, ...order]) if (!knownIds.includes(s)) return fail('SECTION_UNKNOWN', 'That section does not exist on your theme.', 'sections');
  if (new Set(hidden).size !== hidden.length || new Set(order).size !== order.length) return fail('SECTION_UNKNOWN', 'A section is named twice.', 'sections');
  return { ok: true, sections: { hidden: [...hidden], order: [...order] } };
}

const BRAND_KEYS = ['accent', 'accentDark', 'fontHeading', 'fontBody', 'logo'] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Colours must be hex, fonts must come from the theme's own list, the logo is an https image; nothing else (no CSS) is accepted. */
export function validateBrand(input: unknown, themeFonts: readonly string[]): Ok<{ brand: BrandDoc }> | Fail {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('FIELD_INVALID', 'Send the brand settings as an object.', 'brand');
  const b = input as Record<string, unknown>;
  for (const k of Object.keys(b)) if (!(BRAND_KEYS as readonly string[]).includes(k)) return fail('FIELD_LOCKED', `${k} is not a brand setting.`, `brand.${k}`);
  const out: BrandDoc = {};
  for (const k of BRAND_KEYS) {
    if (b[k] === undefined || b[k] === null || b[k] === '') continue;
    if (typeof b[k] !== 'string') return fail('FIELD_INVALID', 'That value must be text.', `brand.${k}`);
    const v = (b[k] as string).trim();
    if (k === 'accent' || k === 'accentDark') { if (!HEX.test(v)) return fail('FIELD_INVALID', 'Use a colour like #0a7d4f.', `brand.${k}`); out[k] = v; }
    else if (k === 'logo') { const c = cleanValue('image', 500, v, 'brand.logo'); if (!c.ok) return c; out.logo = c.value; }
    else { if (!themeFonts.includes(v)) return fail('FONT_NOT_ALLOWED', 'That font is not in your theme\'s list.', `brand.${k}`); out[k] = v; }
  }
  return { ok: true, brand: out };
}

/** Header and footer menus: pages of the theme only, each at most once, a label for every item, and Home stays visible in the header. */
export function validateNavigation(input: unknown, pageKeys: readonly string[]): Ok<{ navigation: NavigationDoc }> | Fail {
  const n = input as Partial<NavigationDoc> | null;
  if (!n || typeof n !== 'object' || !Array.isArray(n.header) || !Array.isArray(n.footer)) return fail('NAV_INVALID', 'Send the header and footer menus as lists.', 'navigation');
  const clean = (list: unknown[], where: string): NavItem[] | Fail => {
    const seen = new Set<string>(); const out: NavItem[] = [];
    for (const [i, raw] of list.entries()) {
      const it = raw as Partial<NavItem> | null;
      if (!it || typeof it !== 'object' || typeof it.key !== 'string' || typeof it.label !== 'string' || typeof it.visible !== 'boolean') return fail('NAV_INVALID', 'Each menu item needs a page, a label and visible true or false.', `navigation.${where}[${i}]`);
      if (!pageKeys.includes(it.key) || seen.has(it.key)) return fail('NAV_INVALID', 'Use each page of your site at most once.', `navigation.${where}[${i}]`);
      const label = it.label.trim();
      if (!label || label.length > 40 || MARKUP.test(label) || CONTROL.test(label)) return fail('NAV_INVALID', 'A menu label is 1 to 40 characters of plain text.', `navigation.${where}[${i}].label`);
      seen.add(it.key); out.push({ key: it.key, label, visible: it.visible });
    }
    return out;
  };
  const header = clean(n.header, 'header'); if (!Array.isArray(header)) return header;
  const footer = clean(n.footer, 'footer'); if (!Array.isArray(footer)) return footer;
  if (header.length && !header.some((h) => h.key === 'home' && h.visible)) return fail('NAV_INVALID', 'Home must stay visible in the header menu.', 'navigation.header');
  return { ok: true, navigation: { header, footer } };
}

/** Set the location. A full map link supplies coordinates the vendor did not type (typed coordinates win); a short or unreadable link is refused with the reason. An empty location removes it. */
export function writeLocation(doc: ManagedDoc, input: unknown): Ok<{ doc: ManagedDoc }> | Fail {
  const r = validateLocation(input);
  if (!r.ok) return r;
  const loc: Location = { ...r.location };
  if (loc.mapLinkInput) {
    const m = parseMapLink(loc.mapLinkInput);
    if (!m.ok) return fail(m.code, m.message, 'mapLinkInput');
    if (loc.latitude === undefined) { loc.latitude = m.coords.latitude; loc.longitude = m.coords.longitude; }
  }
  const { location: _old, ...rest } = doc;
  return { ok: true, doc: Object.keys(loc).length ? { ...rest, location: loc } : (rest as ManagedDoc) };
}

/** Set the Google review link. An empty value removes it. */
export function writeReviewUrl(doc: ManagedDoc, input: unknown): Ok<{ doc: ManagedDoc }> | Fail {
  const r = validateReviewUrl(input);
  if (!r.ok) return fail(r.code, r.message, 'reviewUrl');
  const { reviewUrl: _old, ...rest } = doc;
  return { ok: true, doc: r.url ? { ...rest, reviewUrl: r.url } : (rest as ManagedDoc) };
}

/** Set the testimonials (the whole list). An empty list clears them. `maxCount` is the staff setting (null = not switched on). */
export function writeTestimonials(doc: ManagedDoc, input: unknown, o: { maxCount: number | null }): Ok<{ doc: ManagedDoc }> | Fail {
  const r = validateTestimonials(input, o);
  if (!r.ok) return fail(r.code, r.message, r.field);
  const { testimonials: _old, ...rest } = doc;
  return { ok: true, doc: r.items.length || Array.isArray(input) ? { ...rest, testimonials: r.items } : (rest as ManagedDoc) };
}

/** Set one page's SEO text. An empty edit removes the page's entry (the default shows again). */
export function writeSeo(doc: ManagedDoc, pageKey: string, input: unknown, allowedImages: readonly string[]): Ok<{ doc: ManagedDoc }> | Fail {
  if (!isPageKey(pageKey)) return fail('FIELD_LOCKED', 'That page does not exist.', pageKey);
  const r = validatePageSeo(input, allowedImages);
  if (!r.ok) return r;
  const seo = { ...doc.seo };
  if (Object.keys(r.edit).length === 0) delete seo[pageKey]; else seo[pageKey] = r.edit;
  return { ok: true, doc: { ...doc, seo } };
}

// ── overlay ────────────────────────────────────────────────────────────────────────────────────────

/** the field key -> where the renderer mapping reads it */
const CMS_FIELD: Readonly<Record<string, keyof SourceCms>> = {
  'site.tagline': 'tagline', 'hero.image': 'banner', 'about.text': 'about', 'contact.phone': 'phone', 'contact.email': 'email', 'contact.whatsapp': 'whatsapp', 'contact.address': 'address',
  'social.instagram': 'instagram', 'social.facebook': 'facebook', 'social.youtube': 'youtube', 'social.linkedin': 'linkedin',
};
const EXTRAS_FIELD: Readonly<Record<string, keyof SourceExtras>> = {
  'hero.title': 'headline', 'hero.subtitle': 'subline', 'hero.badge': 'announcement', 'cta.label': 'ctaLabel', 'hero.imageAlt': 'heroImageAlt', 'about.image': 'aboutImage', 'about.imageAlt': 'aboutImageAlt',
};

/**
 * The source document with the vendor's written content laid over it. Pure and non-mutating. Only keys present in the document change anything; the vendor's
 * items (Offerings or Catalogue) are never touched.
 */
export function applyToSource(src: SourceDocument, doc: ManagedDoc): SourceDocument {
  const d = normaliseDoc(doc);
  const cms: SourceCms | null = src.cms ? { ...src.cms, extras: src.cms.extras ? { ...src.cms.extras, social: src.cms.extras.social ? { ...src.cms.extras.social } : undefined } : null } : null;
  const settings: Record<string, unknown> = {};
  if (cms) {
    const extras: SourceExtras = cms.extras ?? {};
    const mutable = cms as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(d.fields)) {
      if (has(CMS_FIELD, k)) mutable[CMS_FIELD[k]] = v;
      else if (has(EXTRAS_FIELD, k)) (extras as Record<string, unknown>)[EXTRAS_FIELD[k]] = v;
      else if (k === 'social.x') extras.social = { ...extras.social, x: v };
      else if (k === 'social.custom') extras.social = { ...extras.social, customUrl: v };
      else if (k === 'social.customLabel') extras.social = { ...extras.social, customLabel: v };
    }
    const L = d.lists;
    if (L.faqs) extras.faq = L.faqs.map((f) => ({ q: String(f.q), a: String(f.a) }));
    if (L.gallery) cms.portfolio = L.gallery.map((g) => ({ src: String(g.src), alt: String(g.alt), title: String(g.title ?? '') }));
    if (L.steps) extras.steps = L.steps.map((s) => ({ title: String(s.title), desc: String(s.desc ?? '') }));
    if (L.trust) extras.trust = L.trust.map((t) => String(t.text));
    if (L.stats) extras.stats = L.stats.map((s) => ({ value: String(s.value), label: String(s.label) }));
    if (L.team) extras.team = L.team.map((t) => ({ name: String(t.name), role: String(t.role ?? ''), note: String(t.note ?? ''), image: String(t.image ?? '') }));
    if (L.credentials) extras.credentials = L.credentials.map((c) => ({ title: String(c.title), detail: String(c.detail ?? '') }));
    if (d.location) {
      const l = d.location; const address = composeAddress(l); const maps = buildDirectionsUrl(l);
      if (address) mutable.address = address;
      if (l.city) extras.city = l.city;
      if (l.pincode) extras.pin = l.pincode;
      if (maps) mutable.googleMaps = maps;
    }
    if (d.testimonials) cms.testimonials = d.testimonials.map((t) => ({ quote: t.text, author: t.name, note: `${TESTIMONIAL_LABEL}${t.date ? ` (${t.date})` : ''}`, proOnly: true }));
    if (L.pages) cms.pages = L.pages.filter((p) => p.enabled === true).map((p) => ({ slug: String(p.slug), title: String(p.title), body: String(p.body), intro: String(p.intro ?? '') }));
    cms.extras = extras;
  }
  for (const k of ['accent', 'accentDark', 'fontHeading', 'fontBody', 'logo'] as const) if (d.brand[k]) settings[k] = d.brand[k];
  if (d.sections.hidden.length) settings.hiddenSections = [...d.sections.hidden];
  if (d.sections.order.length) settings.sectionOrder = [...d.sections.order];
  return { ...src, cms, rendererSettings: { ...(src.rendererSettings ?? {}), ...settings }, ...(Object.keys(d.seo).length ? { pageSeo: d.seo } : {}), ...(d.reviewUrl ? { reviewUrl: d.reviewUrl } : {}), managed: d };
}

// ── hashing and comparing ──────────────────────────────────────────────────────────────────────────

export const hashDoc = (doc: ManagedDoc): string => sha256(stableJson(normaliseDoc(doc)));

export interface DocDiff { fields: string[]; lists: string[]; sections: boolean; brand: boolean; navigation: boolean; seo: string[]; location: boolean; reviewLink: boolean; testimonials: boolean }
export function diffDocs(a: ManagedDoc, b: ManagedDoc): DocDiff {
  const x = normaliseDoc(a); const y = normaliseDoc(b);
  const same = (p: unknown, q: unknown): boolean => stableJson(p) === stableJson(q);
  const keys = [...new Set([...Object.keys(x.fields), ...Object.keys(y.fields)])].filter((k) => x.fields[k] !== y.fields[k]).sort();
  const lists = [...new Set([...Object.keys(x.lists), ...Object.keys(y.lists)])].filter((k) => !same(x.lists[k as ListName], y.lists[k as ListName])).sort();
  const seo = [...new Set([...Object.keys(x.seo), ...Object.keys(y.seo)])].filter((k) => !same(x.seo[k], y.seo[k])).sort();
  return { fields: keys, lists, sections: !same(x.sections, y.sections), brand: !same(x.brand, y.brand), navigation: !same(x.navigation, y.navigation), seo, location: !same(x.location, y.location), reviewLink: x.reviewUrl !== y.reviewUrl, testimonials: !same(x.testimonials, y.testimonials) };
}
