// Two-level demo-site model (Category → Subcategory) layered over the existing
// 20-industry content. Categories = the 20 industries (industry-content.ts).
// Subcategories extend a category additively; unknown subcategories fall back to
// the category baseline (nothing breaks, adding config later is additive).
import { industryContent, type IndustryContent } from './industry-content';

export type SectionType = 'catalog' | 'gallery' | 'team' | 'booking' | 'about' | 'contact' | 'blog';
export interface DemoSection { slug: string; label: string; type: SectionType }

// Sub-category-specific copy, injected OVER the category baseline (any field left
// out falls back to the category's own content). Real content per sub-type — not a
// find-and-replace of the category text.
export interface SubContent {
  tagline?: string;
  shortDesc?: string;      // 1 sentence — cards / meta description
  fullDesc?: string;       // 3-4 sentences — about section
  heroHeadline?: string;
  heroSubline?: string;
  highlight?: string;      // the small highlight strip under headings
  seoKeywords?: string[];  // prepended to the category's own keywords
}

export interface Subcategory {
  id: string;
  name: string;
  /** Extra search terms (besides the name) that resolve to this sub-type. */
  keywords?: string[];
  /** Sub-specific copy injected over the category baseline. */
  content?: SubContent;
}

export const CATEGORY_IDS = industryContent.map((c) => c.id);

// Legacy SEO slugs → canonical industry keys (mirrors the backend INDUSTRY_ALIASES).
// After the Aug 2026 key standardization the canonical ids are clinic/salon/gym; this
// keeps old /demo/healthcare URLs and any stored vendor.industry='healthcare' resolving.
const INDUSTRY_ALIASES: Record<string, string> = { healthcare: 'clinic', beauty: 'salon', fitness: 'gym' };
export function canonicalIndustryId(id: string): string { return INDUSTRY_ALIASES[id] ?? id; }

// Curated subcategories; categories not listed get a single "general" derived from
// the category name. Additive — extend anytime without a migration.
const SUBCATEGORIES: Record<string, Subcategory[]> = {
  clinic: [
    { id: 'general', name: 'Clinic' },
    {
      id: 'dental', name: 'Dental',
      keywords: ['dental', 'dentist', 'dental clinic', 'teeth', 'tooth', 'orthodontist', 'braces', 'root canal', 'dental implant', 'dental care'],
      content: {
        tagline: 'Healthy Smiles, Expert Dental Care',
        shortDesc: 'Dental clinic website with a treatment list, online appointment booking and a smile gallery.',
        fullDesc: 'A website built for dental clinics and dentists. Patients browse your treatments — from routine cleaning and fillings to root canals, braces, aligners and implants — book appointments online and see before/after smile transformations. Your Google profile is optimised so people searching "dentist near me" find you first.',
        heroHeadline: 'Gentle, Modern Dentistry for the Whole Family',
        heroSubline: 'Painless treatments, digital X-rays and same-day appointments',
        highlight: 'Painless treatment · Digital X-ray · EMI available · Open 6 days a week',
        seoKeywords: ['dental clinic website india', 'dentist website', 'dental appointment booking software', 'orthodontist website'],
      },
    },
    {
      id: 'dermatology', name: 'Skin & Hair Clinic',
      keywords: ['dermatology', 'dermatologist', 'skin clinic', 'skin specialist', 'cosmetic', 'cosmetology', 'hair transplant', 'acne', 'laser', 'aesthetic clinic', 'skin doctor'],
      content: {
        tagline: 'Healthy Skin, Confident You',
        shortDesc: 'Dermatology and cosmetology clinic website with a treatment menu, online consultation booking and before/after gallery.',
        fullDesc: 'A website built for skin and hair clinics, dermatologists and cosmetologists. Patients browse your treatments — from acne, pigmentation and anti-ageing to laser hair reduction, PRP and hair transplants — book consultations online and see genuine before/after results. Ideal for aesthetic clinics that live and die by their gallery and reviews.',
        heroHeadline: 'Advanced Skin & Hair Treatments You Can Trust',
        heroSubline: 'Dermatologist-led care — acne, laser, anti-ageing and hair restoration',
        highlight: 'Dermatologist-led · USFDA lasers · Visible results · EMI available',
        seoKeywords: ['dermatology clinic website', 'skin clinic website india', 'cosmetologist website', 'hair transplant clinic website'],
      },
    },
    {
      id: 'orthopedic', name: 'Orthopaedic Clinic',
      keywords: ['orthopedic', 'orthopaedic', 'ortho', 'bone', 'joint', 'knee', 'spine', 'fracture', 'joint replacement', 'arthritis', 'orthopedist'],
      content: {
        tagline: 'Move Freely, Live Painlessly',
        shortDesc: 'Orthopaedic clinic website with a treatment list, online appointment booking and surgeon profiles.',
        fullDesc: 'A website built for orthopaedic surgeons and bone-and-joint clinics. Patients browse your specialities — from fracture care, arthritis and sports injuries to knee and hip replacement and spine surgery — book appointments online and read your surgeons’ credentials. Built to convert people searching for a trusted joint-replacement or knee-pain specialist near them.',
        heroHeadline: 'Expert Care for Bones, Joints & Spine',
        heroSubline: 'Fracture care, arthritis management and advanced joint replacement',
        highlight: 'Joint replacement · Arthroscopy · Sports injury · Digital X-ray on site',
        seoKeywords: ['orthopedic clinic website', 'orthopaedic surgeon website india', 'joint replacement clinic website', 'knee specialist website'],
      },
    },
    {
      id: 'physiotherapy', name: 'Physiotherapy',
      keywords: ['physiotherapy', 'physio', 'physiotherapist', 'rehab', 'sports injury', 'back pain'],
      content: {
        tagline: 'Recover Faster, Move Better',
        shortDesc: 'Physiotherapy clinic website with a therapy menu, online slot booking and home-visit requests.',
        fullDesc: 'A website built for physiotherapy and rehabilitation clinics. Patients browse your therapies — back and neck pain, post-surgery rehab, sports-injury recovery and geriatric care — book sessions online and request home visits for elders. Designed to bring in the back-pain and post-operative rehab enquiries that fill a physio’s calendar.',
        heroHeadline: 'Pain Relief & Rehabilitation That Works',
        heroSubline: 'Back pain, sports injuries and post-surgery recovery — in clinic or at home',
        highlight: 'Manual therapy · Sports rehab · Home visits · Personalised recovery plans',
        seoKeywords: ['physiotherapy clinic website', 'physiotherapist website india', 'sports injury rehab website', 'physio home visit'],
      },
    },
    {
      id: 'general-physician', name: 'General Physician',
      keywords: ['general physician', 'gp', 'family doctor', 'clinic', 'consultation'],
      content: {
        tagline: 'Your Family’s Trusted Doctor',
        shortDesc: 'General physician clinic website with consultation booking, chronic-care services and health certificates.',
        fullDesc: 'A website built for general physicians and family-medicine clinics. Patients book consultations online for everyday illnesses, chronic-care reviews for diabetes and blood pressure, adult vaccinations and same-day fitness certificates. The simple, reassuring front door for a neighbourhood clinic that people return to for years.',
        heroHeadline: 'Trusted Everyday Care for the Whole Family',
        heroSubline: 'Consultations, chronic-care management, vaccinations and health checks',
        highlight: 'Same-day appointments · Diabetes & BP care · Vaccinations · Health certificates',
        seoKeywords: ['general physician website', 'family doctor clinic website', 'gp clinic website india'],
      },
    },
    {
      id: 'hospital', name: 'Hospital',
      keywords: ['hospital', 'multispeciality', 'nursing home', 'medical centre'],
      content: {
        tagline: 'Comprehensive Care Under One Roof',
        shortDesc: 'Multispeciality hospital website with departments, doctor directory, 24/7 emergency info and appointment booking.',
        fullDesc: 'A website built for hospitals and nursing homes. Patients explore your departments — emergency, surgery, cardiology, maternity and more — find the right specialist in the doctor directory, book appointments and see cashless-insurance and 24/7 emergency information at a glance. Built to reassure families choosing where to be treated.',
        heroHeadline: 'Multispeciality Care, Round the Clock',
        heroSubline: '24/7 emergency, expert specialists and cashless insurance under one roof',
        highlight: '24/7 emergency · Cashless insurance · Multispeciality · Ambulance service',
        seoKeywords: ['hospital website india', 'multispeciality hospital website', 'nursing home website'],
      },
    },
  ],
  realestate: [
    { id: 'general', name: 'Real Estate' },
    { id: 'residential', name: 'Residential', keywords: ['residential', 'flats', 'apartments', 'villas', 'houses for sale', 'buy home'] },
    { id: 'commercial', name: 'Commercial', keywords: ['commercial', 'office space', 'shops', 'showroom', 'commercial property'] },
    { id: 'rental', name: 'Rentals', keywords: ['rental', 'rent', 'rent flat', 'pg', 'lease', 'rent house'] },
  ],
  restaurant: [
    { id: 'general', name: 'Restaurant' },
    { id: 'cafe', name: 'Cafe', keywords: ['cafe', 'coffee shop', 'coffee', 'bistro', 'brew'] },
    {
      id: 'cloud-kitchen', name: 'Cloud Kitchen',
      keywords: ['cloud kitchen', 'delivery kitchen', 'ghost kitchen', 'dark kitchen', 'online food delivery', 'delivery only restaurant', 'tiffin service'],
      content: {
        tagline: 'Delivery-First Kitchen — Order Online, Delivered Hot',
        shortDesc: 'Cloud kitchen website with an online-order menu, delivery areas and WhatsApp ordering.',
        fullDesc: 'A website built for cloud kitchens and delivery-only food brands. Customers browse your delivery menu, place orders online or on WhatsApp, and check which areas you deliver to — all without a dine-in space. Perfect for multi-brand kitchens, tiffin services and food-delivery startups running on Swiggy and Zomato.',
        heroHeadline: 'Chef-Cooked Meals, Delivered to Your Door',
        heroSubline: 'Order online for fast delivery — no dine-in, all the flavour',
        highlight: 'Delivery only · 30–45 min · Live on Swiggy & Zomato · WhatsApp orders',
        seoKeywords: ['cloud kitchen website', 'delivery only restaurant website', 'ghost kitchen website india', 'online food ordering system'],
      },
    },
    { id: 'bakery', name: 'Bakery', keywords: ['bakery', 'cake shop', 'cakes', 'pastry', 'confectionery', 'custom cakes'] },
  ],
  salon: [
    { id: 'general', name: 'Salon' },
    { id: 'spa', name: 'Spa', keywords: ['spa', 'massage', 'wellness', 'day spa', 'body spa'] },
    { id: 'nails', name: 'Nail Studio', keywords: ['nails', 'nail studio', 'nail art', 'manicure', 'pedicure', 'nail salon'] },
  ],
  gym: [
    { id: 'general', name: 'Gym' },
    { id: 'yoga', name: 'Yoga Studio', keywords: ['yoga', 'yoga studio', 'meditation', 'yoga classes'] },
    { id: 'crossfit', name: 'CrossFit', keywords: ['crossfit', 'functional training', 'strength', 'wod'] },
  ],
  education: [
    { id: 'general', name: 'School' },
    { id: 'coaching', name: 'Coaching Centre', keywords: ['coaching', 'coaching centre', 'tuition', 'test prep', 'competitive exam'] },
    { id: 'college', name: 'College', keywords: ['college', 'university', 'degree', 'higher education'] },
  ],
};

export function getCategory(id: string): IndustryContent | undefined {
  const canonical = canonicalIndustryId(id);
  return industryContent.find((c) => c.id === canonical);
}

export function getSubcategories(categoryId: string): Subcategory[] {
  const canonical = canonicalIndustryId(categoryId);
  const cat = getCategory(canonical);
  return SUBCATEGORIES[canonical] ?? [{ id: 'general', name: cat?.name ?? 'General' }];
}

/** Resolve a subcategory, falling back to the category baseline (the "general" one). */
export function getSubcategory(categoryId: string, subId?: string): Subcategory {
  const subs = getSubcategories(categoryId);
  return subs.find((s) => s.id === subId) ?? subs[0];
}

// The effective demo copy for a (category, sub) — sub content injected over the
// category baseline. This is what the demo page renders, so a sub-type shows its
// OWN hero/description/keywords rather than the generic category text.
export interface DemoContent {
  name: string;            // display/brand name for this sub-type
  tagline: string;
  shortDesc: string;
  fullDesc: string;
  heroHeadline: string;
  heroSubline: string;
  highlight: string;
  seoKeywords: string[];
}

export function getDemoContent(categoryId: string, subId?: string): DemoContent | undefined {
  const cat = getCategory(categoryId);
  if (!cat) return undefined;
  const sub = getSubcategory(categoryId, subId);
  const c = sub.content ?? {};
  const isSub = sub.id !== 'general';
  return {
    name: isSub ? sub.name : cat.name,
    tagline: c.tagline ?? cat.tagline,
    shortDesc: c.shortDesc ?? cat.shortDesc,
    fullDesc: c.fullDesc ?? cat.fullDesc,
    heroHeadline: c.heroHeadline ?? cat.sampleContent.heroHeadline,
    heroSubline: c.heroSubline ?? cat.sampleContent.heroSubline,
    highlight: c.highlight ?? cat.sampleContent.highlight,
    seoKeywords: [...(c.seoKeywords ?? []), ...cat.seoKeywords],
  };
}

// ── Search / resolution ────────────────────────────────────────────────────
// Resolve a free-text keyword (or a URL segment) to a (category, sub-type). A
// sub-category keyword wins over the plain category so "dental clinic" lands on the
// tailored dental demo, not the generic clinic one.
export interface DemoResolution { categoryId: string; subId: string }

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function containsTerm(haystack: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  return new RegExp(`(^| )${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(haystack);
}

export function resolveDemoQuery(query: string): DemoResolution | null {
  const q = norm(query);
  if (!q) return null;

  // 1) Most specific: a sub-category keyword / name.
  for (const cat of industryContent) {
    for (const sub of getSubcategories(cat.id)) {
      if (sub.id === 'general') continue;
      const terms = [sub.name, sub.id.replace(/-/g, ' '), ...(sub.keywords ?? [])];
      if (terms.some((t) => containsTerm(q, t))) return { categoryId: cat.id, subId: sub.id };
    }
  }
  // 2) Main category: id, name, or one of its SEO keywords.
  for (const cat of industryContent) {
    const terms = [cat.id, cat.name, ...cat.seoKeywords];
    if (terms.some((t) => containsTerm(q, t))) return { categoryId: cat.id, subId: 'general' };
  }
  // 3) Legacy alias (healthcare→clinic, …) as a bare token.
  const alias = canonicalIndustryId(q.replace(/\s+/g, ''));
  if (getCategory(alias)) return { categoryId: alias, subId: 'general' };
  return null;
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function classify(label: string): SectionType {
  const l = label.toLowerCase();
  if (/about/.test(l)) return 'about';
  if (/contact|location/.test(l)) return 'contact';
  if (/blog|news/.test(l)) return 'blog';
  if (/galler|destination|portfolio|photo/.test(l)) return 'gallery';
  if (/doctor|team|stylist|trainer|agent|faculty|fleet|vehicle|staff|coach|photographer|advisor|expert/.test(l)) return 'team';
  if (/reservation|appointment|book|enrol|enquir|enquiry/.test(l)) return 'booking';
  return 'catalog'; // menu / services / packages / listings / products / courses / …
}

/** Section routes for a category (from its curated "Website Pages", minus Home). */
export function getSections(categoryId: string): DemoSection[] {
  const cat = getCategory(categoryId);
  if (!cat) return [];
  return cat.websitePages
    .filter((p) => !/^home$/i.test(p))
    .map((label) => ({ slug: slugify(label), label, type: classify(label) }));
}

export function getSection(categoryId: string, slug: string): DemoSection | undefined {
  return getSections(categoryId).find((s) => s.slug === slug);
}

/** Every public demo URL (for the sitemap): category homes + subcategory homes +
 *  category-level section pages + subcategory-level section pages. */
export function allDemoPaths(): string[] {
  const paths: string[] = [];
  for (const cat of industryContent) {
    paths.push(`/demo/${cat.id}`);
    const sections = getSections(cat.id);
    for (const s of sections) paths.push(`/demo/${cat.id}/${s.slug}`);
    for (const sub of getSubcategories(cat.id)) {
      if (sub.id === 'general') continue; // general == category home, already added
      paths.push(`/demo/${cat.id}/${sub.id}`);
      for (const s of sections) paths.push(`/demo/${cat.id}/${sub.id}/${s.slug}`);
    }
  }
  return paths;
}
