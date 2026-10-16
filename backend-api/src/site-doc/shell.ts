import type { FamilyKey } from './families';

/**
 * The shell (round 2): the words a business uses, the five bottom-navigation slots, and the steps of the primary-action popup. All of it is DATA in the category pack
 * (config.shell), so a new category needs no code. Every family has defaults; a category may change any of it in Admin, Category packs.
 */
export interface BottomNavSlot { key: string; label: string; icon: string; target: string }
export type PopupStepKind = 'choose' | 'when' | 'dates' | 'count' | 'mode' | 'cart' | 'details' | 'confirm';
export interface PopupStep { key: string; kind: PopupStepKind; label: string; source?: 'items' | 'team' | 'options'; options?: string[]; required?: boolean; showWhen?: { step: string; in: string[] } }
export interface Shell {
  terms: { team: string; teamOne: string; items: string; itemOne: string; groups: string };
  /** exactly five slots; the centre one (index 2) is the raised primary action. target: home, items, team, gallery, about, contact, action, cart, more or page:<slug> */
  bottomNav: BottomNavSlot[];
  popup: { title: string; steps: PopupStep[]; confirm: string };
}
export const SHELL_STEP_KINDS: PopupStepKind[] = ['choose', 'when', 'dates', 'count', 'mode', 'cart', 'details', 'confirm'];
export const SHELL_TARGETS = ['home', 'items', 'team', 'gallery', 'about', 'contact', 'action', 'cart', 'more'];
export const SHELL_ICONS = ['home', 'grid', 'book', 'users', 'more', 'menu', 'order', 'cart', 'offers', 'building', 'enquiry', 'visit', 'courses', 'programs', 'contact', 'gallery', 'services', 'products', 'info', 'camera', 'quote', 'plans'];

const nav = (...slots: [string, string, string, string][]): BottomNavSlot[] => slots.map(([key, label, icon, target]) => ({ key, label, icon, target }));
const CONFIRM = 'Thank you. We have your request and will get back to you shortly.';
const DETAILS: PopupStep = { key: 'details', kind: 'details', label: 'Your details', required: true };
const CONFIRM_STEP: PopupStep = { key: 'confirm', kind: 'confirm', label: 'Confirm' };
const TIMES = ['Morning', 'Afternoon', 'Evening'];

export const FAMILY_SHELL: Record<FamilyKey, Shell> = {
  booking: { terms: { team: 'Specialists', teamOne: 'Specialist', items: 'Services', itemOne: 'Service', groups: 'Categories' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Services', 'services', 'items'], ['action', 'Book', 'book', 'action'], ['team', 'Team', 'users', 'team'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Book an appointment', steps: [{ key: 'service', kind: 'choose', label: 'Choose a service', source: 'items', required: true }, { key: 'when', kind: 'when', label: 'Pick a date and time', options: TIMES, required: true }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
  enquiry: { terms: { team: 'Team', teamOne: 'Team member', items: 'Services', itemOne: 'Service', groups: 'Service areas' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Services', 'services', 'items'], ['action', 'Quote', 'quote', 'action'], ['gallery', 'Work', 'gallery', 'gallery'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Get a quote', steps: [{ key: 'need', kind: 'choose', label: 'What do you need?', source: 'items', required: true }, DETAILS, { key: 'calltime', kind: 'when', label: 'Preferred time for a call', options: [...TIMES, 'Any time'] }, CONFIRM_STEP], confirm: CONFIRM } },
  packages: { terms: { team: 'Team', teamOne: 'Team member', items: 'Packages', itemOne: 'Package', groups: 'Package types' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Packages', 'products', 'items'], ['action', 'Enquire', 'enquiry', 'action'], ['gallery', 'Gallery', 'gallery', 'gallery'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Plan your trip', steps: [{ key: 'package', kind: 'choose', label: 'Choose a package', source: 'items', required: true }, { key: 'dates', kind: 'dates', label: 'Travel dates', required: true }, { key: 'travellers', kind: 'count', label: 'Number of travellers', required: true }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
  menu: { terms: { team: 'Chefs', teamOne: 'Chef', items: 'Menu', itemOne: 'Dish', groups: 'Menu sections' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Menu', 'menu', 'items'], ['action', 'Order', 'order', 'action'], ['offers', 'Offers', 'offers', 'page:offers'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Order or reserve', steps: [{ key: 'mode', kind: 'mode', label: 'What would you like?', options: ['Table reservation', 'Pickup order', 'Delivery order'], required: true }, { key: 'when', kind: 'when', label: 'Date and time', options: TIMES, required: true, showWhen: { step: 'mode', in: ['Table reservation'] } }, { key: 'guests', kind: 'count', label: 'Number of guests', required: true, showWhen: { step: 'mode', in: ['Table reservation'] } }, { key: 'cart', kind: 'cart', label: 'Choose your dishes', showWhen: { step: 'mode', in: ['Pickup order', 'Delivery order'] } }, { key: 'dish', kind: 'choose', label: 'Choose a dish', source: 'items', showWhen: { step: 'mode', in: ['Pickup order', 'Delivery order'] } }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
  shop: { terms: { team: 'Team', teamOne: 'Team member', items: 'Products', itemOne: 'Product', groups: 'Categories' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Shop', 'products', 'items'], ['action', 'Cart', 'cart', 'cart'], ['offers', 'Offers', 'offers', 'page:offers'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Your order', steps: [{ key: 'cart', kind: 'cart', label: 'Your cart' }, { key: 'item', kind: 'choose', label: 'Choose a product', source: 'items' }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
  portfolio: { terms: { team: 'Team', teamOne: 'Team member', items: 'Packages', itemOne: 'Package', groups: 'Collections' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['gallery', 'Portfolio', 'gallery', 'gallery'], ['action', 'Book', 'book', 'action'], ['items', 'Packages', 'products', 'items'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Check availability', steps: [{ key: 'package', kind: 'choose', label: 'Choose a package', source: 'items', required: true }, { key: 'date', kind: 'when', label: 'Your date', required: true }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
  listings: { terms: { team: 'Agents', teamOne: 'Agent', items: 'Properties', itemOne: 'Property', groups: 'Property types' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Properties', 'building', 'items'], ['action', 'Visit', 'visit', 'action'], ['about', 'Amenities', 'info', 'about'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Book a site visit', steps: [{ key: 'property', kind: 'choose', label: 'Choose a property', source: 'items', required: true }, { key: 'visit', kind: 'when', label: 'Visit slot', options: TIMES, required: true }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
  courses: { terms: { team: 'Faculty', teamOne: 'Teacher', items: 'Courses', itemOne: 'Course', groups: 'Streams' }, bottomNav: nav(['home', 'Home', 'home', 'home'], ['items', 'Courses', 'courses', 'items'], ['action', 'Enrol', 'enquiry', 'action'], ['team', 'Faculty', 'users', 'team'], ['more', 'More', 'more', 'more']),
    popup: { title: 'Enrol or enquire', steps: [{ key: 'course', kind: 'choose', label: 'Choose a course', source: 'items', required: true }, { key: 'batch', kind: 'choose', label: 'Preferred batch', source: 'options', options: ['Morning', 'Evening', 'Weekend', 'Online'] }, DETAILS, CONFIRM_STEP], confirm: CONFIRM } },
};

export interface ShellOverride { terms?: Partial<Shell['terms']>; bottomNav?: BottomNavSlot[]; popup?: Partial<Shell['popup']> }

/** The words and slots of a category: the family's defaults with the category's own labels on top. */
export function shellFor(family: FamilyKey, override?: ShellOverride): Shell {
  const base = FAMILY_SHELL[family];
  return JSON.parse(JSON.stringify({ terms: { ...base.terms, ...(override?.terms ?? {}) }, bottomNav: override?.bottomNav ?? base.bottomNav, popup: { ...base.popup, ...(override?.popup ?? {}) } })) as Shell;
}

/** Plain-sentence problems with a shell (empty = fine). */
export function validateShell(s: unknown): string[] {
  const p: string[] = [];
  const o = (s && typeof s === 'object' ? s : {}) as Partial<Shell>;
  const t = (o.terms ?? {}) as Record<string, unknown>;
  if (!['team', 'teamOne', 'items', 'itemOne', 'groups'].every((k) => typeof t[k] === 'string' && String(t[k]).trim() && String(t[k]).length <= 40)) p.push('Words: fill in what this business calls its team, a team member, its items, one item and its groups (up to 40 characters each).');
  const navSlots = Array.isArray(o.bottomNav) ? o.bottomNav : [];
  if (navSlots.length !== 5) p.push('The mobile bottom navigation needs exactly 5 slots; the centre one is the main action.');
  else {
    if (navSlots[2]?.target !== 'action' && navSlots[2]?.target !== 'cart') p.push('The centre slot of the bottom navigation must be the main action (target "action") or the cart.');
    for (const n of navSlots) {
      if (!n || typeof n.label !== 'string' || !n.label.trim() || n.label.length > 14) p.push('Every bottom navigation label must be 1 to 14 characters.');
      if (!SHELL_ICONS.includes(String(n?.icon))) p.push(`Bottom navigation icon "${String(n?.icon)}" is not one of: ${SHELL_ICONS.join(', ')}.`);
      if (!(SHELL_TARGETS.includes(String(n?.target)) || /^page:[a-z0-9]+(-[a-z0-9]+)*$/.test(String(n?.target)))) p.push(`Bottom navigation target "${String(n?.target)}" is not allowed (use ${SHELL_TARGETS.join(', ')} or page:<address>).`);
    }
  }
  const steps = Array.isArray(o.popup?.steps) ? (o.popup as Shell['popup']).steps : [];
  if (!steps.length || steps.length > 8) p.push('The popup needs 1 to 8 steps.');
  for (const st of steps) {
    if (!st || !SHELL_STEP_KINDS.includes(st.kind)) p.push(`A popup step has a kind that is not one of: ${SHELL_STEP_KINDS.join(', ')}.`);
    else if (typeof st.label !== 'string' || !st.label.trim() || st.label.length > 60) p.push('Every popup step needs a label of up to 60 characters.');
  }
  if (steps.length && !steps.some((st) => st?.kind === 'details')) p.push('The popup needs a details step (name and phone), so the business can reach the visitor.');
  if (typeof o.popup?.title !== 'string' || !o.popup.title.trim()) p.push('The popup needs a title.');
  return p;
}
