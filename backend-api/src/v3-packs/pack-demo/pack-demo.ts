import content from './pack-demo-content.json';

/** One pack's demo content: a believable sample business of that trade (invented), what it does, who works there, the questions customers ask. It holds NO price and no offer. */
export interface PackDemo {
  packName: string; kitCategory: string;
  business: { name: string; tagline: string; city: string; about: string };
  terms: { items: string; itemOne: string; team: string; teamOne: string };
  services: Array<{ name: string; description: string; badge: string | null }>;
  people: Array<{ name: string; role: string }>;
  faqs: Array<{ question: string; answer: string }>;
  areas: string[];
  hours: Array<{ day: string; open: string; close: string; closed: boolean }>;
  steps: Array<{ title: string; description: string }>;
  sections: Array<{ key: string; title: string; items: Array<{ title: string; detail: string }> }>;
  isSample: true;
}

const PACKS = (content as { packs: Record<string, PackDemo> }).packs;
export const PACK_DEMO_KEYS: readonly string[] = Object.keys(PACKS);
/** The demo content of a pack, or null for a key that is not one of the packs. */
export const packDemo = (key: string): PackDemo | null => (Object.prototype.hasOwnProperty.call(PACKS, key) ? PACKS[key] : null);
