// Builds themes/schema/theme.schema.json from the vocabulary (so the enums cannot drift). A test checks the committed file equals this output.
import { CATEGORY_IDS, FAMILY_IDS } from './categories.mjs';
import { TRACKS, TIERS, APPROVED_FONTS, MOTION_INTENSITIES } from './vocabulary.mjs';

const KEBAB = '^[a-z0-9]+(-[a-z0-9]+)*$';
const UPPER_KEY = '^[A-Z][A-Z0-9_]{1,40}$';
const list = (items, maxItems, extra = {}) => ({ type: 'array', uniqueItems: true, maxItems, items, ...extra });

/**
 * Marketplace metadata (theme package spec v1, docs/v3/THEME_PACKAGE_SPEC.md). OPTIONAL for the kit (the six library themes have none and stay valid); REQUIRED by the backend to publish a theme to the marketplace.
 * This is the SHAPE only. Which pack, add-on, capability, combination tag and catalogue category names are real is decided by the backend (it owns those lists), so no vocabulary is copied here.
 */
const MARKETPLACE = {
  type: 'object', additionalProperties: false, required: ['packs'],
  description: 'Marketplace metadata: who the theme is for and how it is found. The shape is checked here, the names by the backend.',
  properties: {
    packs: list({ type: 'string', pattern: UPPER_KEY }, 16, { minItems: 1, description: 'industry pack keys the theme is designed for' }),
    addons: list({ type: 'string', pattern: UPPER_KEY }, 8, { description: 'add-on pack keys the theme also draws (SHOP, ONLINE_ORDERING_DELIVERY, PHARMACY_COUNTER, HOME_SAMPLE_COLLECTION)' }),
    capabilities: list({ type: 'string', pattern: UPPER_KEY }, 14, { description: 'capability keys the theme draws' }),
    tags: list({ type: 'string', pattern: KEBAB, maxLength: 60 }, 12, { description: 'combination tags, for example service-plus-shop' }),
    catalogueCategories: list({ type: 'string', pattern: KEBAB, maxLength: 80 }, 200, { description: 'ids from the 196-category catalogue (the kit category ids stay in `categories`)' }),
    previews: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['path', 'alt'], properties: { path: { type: 'string', pattern: '^assets/previews/[a-z0-9-]+\\.(png|jpg|jpeg|webp)$' }, alt: { type: 'string', minLength: 3, maxLength: 160 }, page: { type: 'string', pattern: KEBAB, maxLength: 30 } } } },
    licence: { type: 'string', minLength: 3, maxLength: 300, description: 'a plain note on who may use the theme; not legal wording' },
    starter: { type: 'boolean', description: 'true for a starter theme built by the Get4Domain team (said honestly in the listing)' },
    sourceVendorId: { type: ['string', 'null'], maxLength: 40, description: 'the vendor a custom theme was first built for; null for a theme built for the marketplace. The upload route sets the real value; a different non-null value is refused.' },
  },
};

export function buildSchema() {
  const bool = { type: 'boolean' };
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://get4domain.com/schemas/theme.schema.json',
    title: 'Get4Domain theme manifest (theme.json), contract version 1',
    description: 'Fields marked "package only" are filled by `pack` and required in a packaged zip. Validated by themes/lib/schema.mjs (a small subset validator, no dependencies).',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'version', 'name', 'tier', 'tracks', 'families', 'categories', 'layoutVariantRules', 'motion', 'settingsSchema', 'fonts'],
    properties: {
      id: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', minLength: 3, maxLength: 40 },
      version: { type: 'integer', minimum: 1 },
      name: { type: 'string', minLength: 2, maxLength: 80 },
      tier: { type: 'string', enum: TIERS },
      tracks: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: TRACKS } },
      families: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: FAMILY_IDS } },
      categories: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: CATEGORY_IDS } },
      layoutVariantRules: { type: 'object', additionalProperties: { type: 'string', minLength: 3, maxLength: 40 } },
      motion: {
        type: 'object', additionalProperties: false, required: ['default'],
        properties: {
          default: { type: 'string', enum: MOTION_INTENSITIES },
          variantDefaults: { type: 'object', additionalProperties: { type: 'string', enum: MOTION_INTENSITIES } },
        },
      },
      settingsSchema: {
        type: 'object', additionalProperties: false,
        properties: { accent: bool, fonts: bool, logo: bool, sectionOrder: bool, sectionVisibility: bool, motionIntensity: bool },
      },
      fonts: { type: 'array', uniqueItems: true, maxItems: 12, items: { type: 'string', enum: APPROVED_FONTS } },
      assets: {
        type: 'array',
        description: 'package only: every file under assets/',
        items: { type: 'object', additionalProperties: false, required: ['path', 'bytes', 'sha256'], properties: { path: { type: 'string', pattern: '^assets/' }, bytes: { type: 'integer', minimum: 0 }, sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' } } },
      },
      contentHash: { type: 'string', pattern: '^[0-9a-f]{64}$', description: 'package only' },
      internal: { type: 'boolean', description: 'true only for the kit\'s own _starter theme; never offered to vendors' },
      marketplace: MARKETPLACE,
      author: { type: 'string', maxLength: 80 },
      description: { type: 'string', maxLength: 400 },
    },
  };
}
