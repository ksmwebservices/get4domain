// Builds themes/schema/theme.schema.json from the vocabulary (so the enums cannot drift). A test checks the committed file equals this output.
import { CATEGORY_IDS, FAMILY_IDS } from './categories.mjs';
import { TRACKS, TIERS, APPROVED_FONTS, MOTION_INTENSITIES } from './vocabulary.mjs';

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
      fonts: { type: 'array', uniqueItems: true, maxItems: 4, items: { type: 'string', enum: APPROVED_FONTS } },
      assets: {
        type: 'array',
        description: 'package only: every file under assets/',
        items: { type: 'object', additionalProperties: false, required: ['path', 'bytes', 'sha256'], properties: { path: { type: 'string', pattern: '^assets/' }, bytes: { type: 'integer', minimum: 0 }, sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' } } },
      },
      contentHash: { type: 'string', pattern: '^[0-9a-f]{64}$', description: 'package only' },
      internal: { type: 'boolean', description: 'true only for the kit\'s own _starter theme; never offered to vendors' },
      author: { type: 'string', maxLength: 80 },
      description: { type: 'string', maxLength: 400 },
    },
  };
}
