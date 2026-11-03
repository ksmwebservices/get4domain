// Builds themes/schema/preset.schema.json from the vocabulary (a test checks the committed file equals this output).
import { CATEGORY_IDS } from './categories.mjs';
import { APPROVED_FONTS, PRESET_PATTERNS, FREE_LIMITS } from './vocabulary.mjs';

export function buildPresetSchema() {
  const hex = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
  const mode = { type: 'object', additionalProperties: false, required: ['primary', 'accent', 'background'], properties: { primary: hex, accent: hex, background: hex } };
  const pairs = (keys, max) => ({ type: 'array', minItems: 1, maxItems: max, items: { type: 'object', additionalProperties: false, required: keys, properties: Object.fromEntries(keys.map((k) => [k, { type: 'string', minLength: 1, maxLength: 400 }])) } });
  const both = (keys, max) => ({ type: 'object', additionalProperties: false, required: ['en', 'ta'], properties: { en: pairs(keys, max), ta: pairs(keys, max) } });
  const ids = { type: 'array', uniqueItems: true, items: { type: 'string', pattern: '^[a-z0-9-]+$' } };
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://get4domain.com/schemas/preset.schema.json',
    title: 'Get4Domain category preset (presets/<categoryId>.json), contract version 1',
    description: 'The default look and starter content of one category inside a theme. The vendor\'s own settings override it. Validated by themes/lib/preset.mjs.',
    type: 'object',
    additionalProperties: false,
    required: ['category', 'palette', 'fonts', 'blocks', 'hero', 'services', 'faqs'],
    properties: {
      category: { type: 'string', enum: CATEGORY_IDS },
      palette: { type: 'object', additionalProperties: false, required: ['light', 'dark'], properties: { light: mode, dark: mode } },
      fonts: { type: 'object', additionalProperties: false, required: ['heading', 'body'], properties: { heading: { type: 'string', enum: APPROVED_FONTS }, body: { type: 'string', enum: APPROVED_FONTS } } },
      blocks: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1, maxLength: 40 } },
      hero: { type: 'object', additionalProperties: false, required: ['pattern'], properties: { pattern: { type: 'string', enum: PRESET_PATTERNS } } },
      services: both(['name', 'description'], FREE_LIMITS.services),
      faqs: both(['q', 'a'], FREE_LIMITS.faqs),
      sections: { type: 'object', additionalProperties: false, properties: { order: ids, hidden: ids } },
    },
  };
}
