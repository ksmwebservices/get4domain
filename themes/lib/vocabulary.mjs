// The one vocabulary shared by the schema, the renderer, the lint and the package validator.
// It is a SUPERSET of the as-built contract (backend-api/src/themes/core/theme-contract.json): every as-built name is kept
// (a test enforces it) and the V3 additions are listed separately so they are easy to review.
// Plain data, no imports: the backend can import this file later.

export const CONTRACT_VERSION = 1;

/** Scalar bindings: {{name}}. */
export const AS_BUILT_BINDINGS = [
  'site.name', 'site.tagline', 'site.logo', 'site.favicon', 'site.year', 'site.url',
  'hero.title', 'hero.subtitle', 'hero.image', 'hero.cta',
  'about.title', 'about.text', 'about.image',
  'contact.phone', 'contact.phoneHref', 'contact.whatsapp', 'contact.email', 'contact.address', 'contact.mapUrl',
  'hours',
  'social.instagram', 'social.facebook', 'social.youtube', 'social.linkedin', 'social.x', 'social.whatsapp', 'social.maps', 'social.custom', 'social.customLabel',
  'page.title', 'page.body', 'page.slug',
  'terms.team', 'terms.teamOne', 'terms.items', 'terms.itemOne', 'terms.groups',
  'cta.label',
];

/** V3 additions (each maps a T0 brief key that the as-built contract has no slot for). */
export const V3_BINDINGS = [
  'site.established', 'site.registrationNo', 'site.logoAlt',
  'hero.imageAlt', 'about.imageAlt',
  'cta.href', 'cta.secondaryLabel', 'cta.secondaryHref',
  'contact.city', 'contact.area', 'contact.pin', 'contact.whatsappHref',
  'social.pinterest', 'social.telegram', 'social.whatsappChannel',
  'page.intro',
  // Platform wording in the visitor's language (English or Tamil): the theme never hard-codes it.
  'ui.skip', 'ui.call', 'ui.whatsapp', 'ui.directions', 'ui.menu', 'ui.readMore', 'ui.viewAll', 'ui.home', 'ui.about', 'ui.gallery', 'ui.contact',
];

export const BINDINGS = [...AS_BUILT_BINDINGS, ...V3_BINDINGS];

const ITEM_FIELDS = ['id', 'name', 'description', 'price', 'image', 'duration', 'badge', 'href', 'category', 'tags', 'includes', 'location', 'area', 'bedrooms', 'veg', 'slug'];

/** Repeaters: <template data-g4d-each="NAME"> ... {{VAR.field}} ... </template>. */
export const AS_BUILT_REPEATERS = {
  items: { as: 'item', fields: ITEM_FIELDS },
  groups: { as: 'group', fields: ['name', 'slug', 'count', 'items'] },
  team: { as: 'member', fields: ['id', 'name', 'role', 'note', 'image'] },
  testimonials: { as: 'testimonial', fields: ['quote', 'author', 'note'] },
  faqs: { as: 'faq', fields: ['q', 'a'] },
  gallery: { as: 'image', fields: ['src', 'alt', 'title'] },
  steps: { as: 'step', fields: ['title', 'desc', 'n'] },
  trust: { as: 'point', fields: ['text'] },
  stats: { as: 'stat', fields: ['value', 'label'] },
  pages: { as: 'navpage', fields: ['title', 'href'] },
};

export const V3_REPEATERS = {
  areas: { as: 'area', fields: ['name'] },
  credentials: { as: 'credential', fields: ['title', 'detail'] },
  // Category extra blocks (price list, packages, timetable ...): one generic loop renders every block the category has.
  blocks: { as: 'block', fields: ['key', 'title', 'items'] },
  'block.items': { as: 'entry', fields: ['title', 'detail', 'price'] },
};

export const REPEATERS = { ...AS_BUILT_REPEATERS, ...V3_REPEATERS };
/** Nested lists reachable from a loop variable, e.g. data-g4d-each="group.items". */
export const NESTED_LISTS = { 'group.items': 'items', 'block.items': 'block.items' };

/** The item page binds the single item as {{item.*}}. */
export const ITEM_BINDINGS = ITEM_FIELDS.map((f) => `item.${f}`);

export const DATA_ATTRIBUTES = [
  'data-g4d-each', 'data-g4d-as', 'data-g4d-if', 'data-g4d-if-not', 'data-g4d-open', 'data-g4d-quickview', 'data-g4d-item',
  // V3: the section wrapper that lets a vendor hide or reorder a section where allowed.
  'data-g4d-section', 'data-g4d-label', 'data-g4d-optional',
];

/** Platform slots. `tag` is how a template places the slot (as-built style custom element). */
export const SLOTS = {
  // as-built engine tags
  action: { tag: 'g4d-action', as: 'engine' },
  'header-nav': { tag: 'g4d-header-nav', as: 'engine' },
  'bottom-nav': { tag: 'g4d-bottom-nav', as: 'engine' },
  footer: { tag: 'g4d-footer', as: 'engine' },
  hours: { tag: 'g4d-hours', as: 'engine' },
  tabs: { tag: 'g4d-tabs', as: 'engine' },
  map: { tag: 'g4d-map', as: 'engine' },
  'social-links': { tag: 'g4d-social', as: 'engine' }, // T0 calls it social-links; the as-built tag is kept
  cart: { tag: 'g4d-cart', as: 'engine' },
  // V3 additions
  'enquiry-form': { tag: 'g4d-enquiry-form', as: 'v3' },
  'whatsapp-float': { tag: 'g4d-whatsapp-float', as: 'v3' },
  reviews: { tag: 'g4d-reviews', as: 'v3' },
  video: { tag: 'g4d-video', as: 'v3' },
  booking: { tag: 'g4d-booking', as: 'v3' },
  'product-grid': { tag: 'g4d-product-grid', as: 'v3' },
  search: { tag: 'g4d-search', as: 'v3' },
  'claim-banner': { tag: 'g4d-claim-banner', as: 'v3' },
  'listed-on-badge': { tag: 'g4d-listed-on-badge', as: 'v3' },
  'open-now': { tag: 'g4d-open-now', as: 'v3' },
  'share-qr': { tag: 'g4d-share-qr', as: 'v3' },
};
export const SLOT_BY_TAG = Object.fromEntries(Object.entries(SLOTS).map(([name, s]) => [s.tag, name]));
export const SLOT_TAGS = Object.keys(SLOT_BY_TAG);

/** Slots every theme must place; Premium themes must also place `video`; product-grid is required for Ecommerce categories. */
export const REQUIRED_SLOTS_ALL = ['enquiry-form', 'whatsapp-float', 'map', 'reviews', 'social-links', 'open-now', 'share-qr', 'listed-on-badge', 'action', 'header-nav', 'footer'];
export const REQUIRED_SLOTS_PREMIUM = ['video'];

/** Hosts that may appear in an iframe or a click-to-load video link. Nothing else may be loaded from outside. */
export const MAP_EMBED_HOSTS = ['www.google.com', 'maps.google.com', 'www.openstreetmap.org'];
export const VIDEO_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com'];

/** The only fonts a theme may name (T0 rule 4). Delivered by the platform from its own storage, never from a third-party host. */
export const APPROVED_FONTS = ['Inter', 'Poppins', 'DM Sans', 'Manrope', 'Nunito', 'Work Sans', 'Montserrat', 'Playfair Display', 'Lora', 'Merriweather'];
/** System fonts allowed in a stack (no network). The Tamil names make Tamil text render without any web font. */
export const SYSTEM_FONTS = ['system-ui', 'ui-sans-serif', 'ui-serif', 'sans-serif', 'serif', 'monospace', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Georgia', 'Noto Sans', 'Noto Serif', 'Noto Sans Tamil', 'Noto Serif Tamil', 'Latha', 'Nirmala UI', 'Tamil Sangam MN', 'Tamil MN', 'Lohit Tamil', 'inherit'];
export const TAMIL_CAPABLE_FONTS = ['Noto Sans Tamil', 'Noto Serif Tamil', 'Latha', 'Nirmala UI', 'Tamil Sangam MN', 'Tamil MN', 'Lohit Tamil'];

export const TOKENS = ['--g4d-primary', '--g4d-primary-contrast', '--g4d-accent', '--g4d-bg', '--g4d-surface', '--g4d-text', '--g4d-muted', '--g4d-border', '--g4d-radius', '--g4d-font-heading', '--g4d-font-body'];
export const MOTION_TOKENS = ['--g4d-motion-speed', '--g4d-motion-ease', '--g4d-motion-distance'];

export const MOTION_INTENSITIES = ['Off', 'Low', 'Medium', 'Rich'];
export const TIERS = ['Standard', 'Premium'];
export const TRACKS = ['handyman', 'professional', 'ecommerce'];

export const LIMITS = {
  packageBytes: 5 * 1024 * 1024,
  fileBytes: 1024 * 1024,
  maxFiles: 400,
  htmlPageBytes: 100 * 1024,   // T0 rule 8
  layoutCssBytes: 40 * 1024,   // T1B
  motionCssBytes: 6 * 1024,    // T5
  maxExpansionRatio: 50,       // zip bomb guard
};

export const PAGE_TEMPLATES = ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item', 'menu', 'packages', 'properties', 'courses', 'doctors', 'portfolio'];
export const CSS_FILES = ['base', 'tokens', 'motion', 'print'];
export const RESERVED_SLUGS = ['book', 'enquire', 'order', 'legal', 'p', 'api'];
export const ALLOWED_URI_SCHEMES = ['http', 'https', 'tel', 'mailto'];
export const BREAKPOINTS = [360, 414, 768, 1024, 1280, 1536];
