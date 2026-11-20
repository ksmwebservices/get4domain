import { industryContent, type IndustryContent } from '@/data/industry-content';

/**
 * Industry packs, DERIVED from the full main-category list (src/data/industry-content.ts): one pack per main category, however many there are. Nothing here is a fixed
 * list of packs; a main category added to the data gets a pack (and a flagship theme) automatically, with its family guessed from its words when the table below
 * does not know it. A pack is design DATA: the flow family (which decides the layout), a hue, starter content and an image style.
 */
export const FAMILIES = ['shop', 'booking', 'enquiry', 'packages', 'menu', 'portfolio', 'listings', 'courses'] as const;
export type Family = (typeof FAMILIES)[number];
export const IMAGERY = ['plates', 'portraits', 'products', 'trips', 'tools', 'work', 'homes', 'classes'] as const;
export type Imagery = (typeof IMAGERY)[number];

/** The family of each known main category. Anything not listed is guessed from its words (guessFamily), so a new main category still gets a pack. */
const FAMILY_OF: Record<string, Family> = {
  restaurant: 'menu', travel: 'packages', clinic: 'booking', education: 'courses', realestate: 'listings', retail: 'shop', salon: 'booking', gym: 'packages', construction: 'enquiry',
  professional: 'enquiry', events: 'packages', finance: 'enquiry', automobile: 'booking', logistics: 'enquiry', hotel: 'packages', diagnostics: 'booking', photography: 'portfolio',
  technology: 'portfolio', agriculture: 'shop', coaching: 'courses', petcare: 'booking', movers: 'enquiry', astrology: 'booking', pestcontrol: 'enquiry', interior: 'portfolio',
  homeservices: 'booking', rentalservices: 'listings', printing: 'shop', recruitment: 'enquiry', government: 'enquiry',
};
const HUE_OF: Record<string, number> = {
  restaurant: 14, travel: 200, clinic: 174, education: 232, realestate: 152, retail: 336, salon: 322, gym: 8, construction: 32, professional: 218, events: 292, finance: 160, automobile: 214,
  logistics: 24, hotel: 38, diagnostics: 188, photography: 270, technology: 246, agriculture: 108, coaching: 260, petcare: 28, movers: 18, astrology: 282, pestcontrol: 120, interior: 44,
  homeservices: 206, rentalservices: 196, printing: 340, recruitment: 226, government: 224,
};
const IMAGERY_OF: Record<Family, Imagery> = { menu: 'plates', booking: 'portraits', shop: 'products', packages: 'trips', enquiry: 'tools', portfolio: 'work', listings: 'homes', courses: 'classes' };

/** Words that suggest a family, for a main category the table does not know. */
const GUESS: [RegExp, Family][] = [
  [/food|restaurant|cafe|kitchen|bakery|catering|sweet/i, 'menu'], [/shop|store|retail|mart|boutique|trading|supplies/i, 'shop'], [/clinic|salon|spa|care|repair|service|booking|appointment|doctor|lab/i, 'booking'],
  [/travel|tour|hotel|resort|stay|event|wedding|gym|fitness|yoga/i, 'packages'], [/school|class|course|tuition|coaching|academy|training|institute/i, 'courses'],
  [/estate|property|rental|rent|housing|land/i, 'listings'], [/photo|design|studio|art|portfolio|interior|software|web|creative/i, 'portfolio'],
];
export function guessFamily(id: string, name: string): Family {
  const hit = GUESS.find(([re]) => re.test(`${id} ${name}`));
  return hit ? hit[1] : 'enquiry';
}
const hashHue = (s: string): number => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };

export interface PackStarter {
  headline: string; subline: string; tagline: string; highlight: string; cta: string;
  /** names only (never prices): the service names a new site of this pack starts with */
  services: string[];
}
export interface SitePack {
  id: string; name: string; family: Family; hue: number; imagery: Imagery;
  /** words that point a vendor's industry text to this pack */
  aliases: string[];
  starter: PackStarter;
  /** the folder under /starter/ that holds this pack's pictures ('general' when there is none of its own) */
  starterFolder: string;
}

const CTA_OF: Record<Family, string> = { shop: 'Enquire', booking: 'Book now', enquiry: 'Get a quote', packages: 'Plan my trip', menu: 'Reserve a table', portfolio: 'Start a project', listings: 'Enquire', courses: 'Enquire' };
const CTA_BY_ID: Record<string, string> = { travel: 'Plan my trip', gym: 'Join now', hotel: 'Check availability', events: 'Plan my event', clinic: 'Book an appointment', salon: 'Book a slot', automobile: 'Book a service', retail: 'Enquire', restaurant: 'Reserve a table' };

/** Which /starter/ folder holds pictures for a pack (the ones that exist in public/starter). */
const STARTER_FOLDERS = new Set(['advocate', 'agriculture', 'automobile', 'clinic', 'coaching', 'construction', 'diagnostics', 'education', 'events', 'finance', 'freelancer', 'general', 'gym', 'home-services', 'hotel', 'logistics', 'photography', 'professional', 'realestate', 'restaurant', 'retail', 'salon', 'technology', 'travel']);
const STARTER_ALIAS: Record<string, string> = { homeservices: 'home-services', pestcontrol: 'home-services', movers: 'logistics', rentalservices: 'realestate', interior: 'construction', printing: 'retail', recruitment: 'professional', government: 'professional', petcare: 'general', astrology: 'general' };
export function starterFolderFor(id: string): string {
  if (STARTER_FOLDERS.has(id)) return id;
  return STARTER_ALIAS[id] ?? 'general';
}

export function derivePack(c: IndustryContent): SitePack {
  const family = FAMILY_OF[c.id] ?? guessFamily(c.id, c.name);
  const sc = c.sampleContent;
  const words = [c.id, ...c.name.split(/[^a-z0-9]+/i), ...c.seoKeywords.flatMap((k) => k.split(/[^a-z0-9]+/i))].map((w) => w.toLowerCase()).filter((w) => w.length > 2);
  return {
    id: c.id, name: c.name, family, hue: HUE_OF[c.id] ?? hashHue(c.id), imagery: IMAGERY_OF[family],
    aliases: [...new Set(words)],
    starter: { headline: sc.heroHeadline, subline: sc.heroSubline, tagline: c.tagline, highlight: sc.highlight, cta: CTA_BY_ID[c.id] ?? CTA_OF[family], services: sc.services.slice(0, 8) },
    starterFolder: starterFolderFor(c.id),
  };
}

/** The safe default: used when nothing matches a business (the neutral enquiry layout in a calm blue). */
export const GENERAL_PACK: SitePack = {
  id: 'general', name: 'Local business', family: 'enquiry', hue: 214, imagery: 'tools', aliases: [],
  starter: { headline: 'Welcome', subline: 'Get in touch to find out how we can help.', tagline: 'Your local business', highlight: 'Local and easy to reach', cta: 'Get in touch', services: ['Our services'] },
  starterFolder: 'general',
};

/** One pack per main category in the data. */
export const PACKS: readonly SitePack[] = industryContent.map(derivePack);
export const PACK_IDS: readonly string[] = PACKS.map((p) => p.id);

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Old and other names for main categories (the same ones demo-site.ts keeps, plus the backend's category keys that sit under a main category). */
const ID_ALIASES: Record<string, string> = { healthcare: 'clinic', beauty: 'salon', fitness: 'gym', 'real-estate': 'realestate', 'home-services': 'homeservices', 'pest-control': 'pestcontrol', 'pet-care': 'petcare', advocate: 'professional', freelancer: 'professional', general: 'general' };

export function packById(id: string | null | undefined): SitePack | null {
  const raw = String(id ?? '').trim().toLowerCase();
  const k = squash(raw);
  if (!k) return null;
  const alias = ID_ALIASES[raw] ?? ID_ALIASES[k];
  if (alias === 'general') return GENERAL_PACK;
  return PACKS.find((p) => squash(p.id) === k || p.id === alias) ?? null;
}

/**
 * The closest pack for a vendor's industry or category text: an exact id or alias first, then the pack with the most words in common (a name word counts more),
 * else the safe default pack. Never throws and never returns null.
 */
export function closestPack(text: string | null | undefined): SitePack {
  const t = String(text ?? '').trim();
  if (!t) return GENERAL_PACK;
  const exact = packById(t);
  if (exact) return exact;
  const words = norm(t).split(' ').filter((w) => w.length > 2);
  if (!words.length) return GENERAL_PACK;
  let best: SitePack | null = null; let bestScore = 0;
  for (const p of PACKS) {
    const nameWords = new Set(norm(p.name).split(' '));
    let s = 0;
    for (const w of words) {
      if (squash(p.id) === squash(w)) s += 5;
      if (nameWords.has(w)) s += 2;
      if (p.aliases.includes(w)) s += 1;
      else if (p.aliases.some((a) => a.length > 4 && w.length > 4 && (a.startsWith(w) || w.startsWith(a)))) s += 0.5;
    }
    if (s > bestScore) { best = p; bestScore = s; }
  }
  return best && bestScore >= 1 ? best : GENERAL_PACK;
}
