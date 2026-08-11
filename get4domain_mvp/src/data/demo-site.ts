// Two-level demo-site model (Category → Subcategory) layered over the existing
// 20-industry content. Categories = the 20 industries (industry-content.ts).
// Subcategories extend a category additively; unknown subcategories fall back to
// the category baseline (nothing breaks, adding config later is additive).
import { industryContent, type IndustryContent } from './industry-content';

export type SectionType = 'catalog' | 'gallery' | 'team' | 'booking' | 'about' | 'contact' | 'blog';
export interface DemoSection { slug: string; label: string; type: SectionType }
export interface Subcategory { id: string; name: string }

export const CATEGORY_IDS = industryContent.map((c) => c.id);

// Curated subcategories; categories not listed get a single "general" derived from
// the category name. Additive — extend anytime without a migration.
const SUBCATEGORIES: Record<string, Subcategory[]> = {
  healthcare: [
    { id: 'general', name: 'Clinic' }, { id: 'dental', name: 'Dental' },
    { id: 'physiotherapy', name: 'Physiotherapy' }, { id: 'general-physician', name: 'General Physician' },
    { id: 'hospital', name: 'Hospital' },
  ],
  realestate: [
    { id: 'general', name: 'Real Estate' }, { id: 'residential', name: 'Residential' },
    { id: 'commercial', name: 'Commercial' }, { id: 'rental', name: 'Rentals' },
  ],
  restaurant: [
    { id: 'general', name: 'Restaurant' }, { id: 'cafe', name: 'Cafe' },
    { id: 'cloud-kitchen', name: 'Cloud Kitchen' }, { id: 'bakery', name: 'Bakery' },
  ],
  beauty: [
    { id: 'general', name: 'Salon' }, { id: 'spa', name: 'Spa' }, { id: 'nails', name: 'Nail Studio' },
  ],
  fitness: [
    { id: 'general', name: 'Gym' }, { id: 'yoga', name: 'Yoga Studio' }, { id: 'crossfit', name: 'CrossFit' },
  ],
  education: [
    { id: 'general', name: 'School' }, { id: 'coaching', name: 'Coaching Centre' }, { id: 'college', name: 'College' },
  ],
};

export function getCategory(id: string): IndustryContent | undefined {
  return industryContent.find((c) => c.id === id);
}

export function getSubcategories(categoryId: string): Subcategory[] {
  const cat = getCategory(categoryId);
  return SUBCATEGORIES[categoryId] ?? [{ id: 'general', name: cat?.name ?? 'General' }];
}

/** Resolve a subcategory, falling back to the category baseline (the "general" one). */
export function getSubcategory(categoryId: string, subId?: string): Subcategory {
  const subs = getSubcategories(categoryId);
  return subs.find((s) => s.id === subId) ?? subs[0];
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
