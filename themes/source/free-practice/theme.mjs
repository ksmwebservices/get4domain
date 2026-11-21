import { makePalette } from '../../lib/preset-build.mjs';
import presets from './presets.mjs';

// Practice: healthcare, legal and finance, creative and consulting. Calm, clean, professional.
export default {
  id: 'free-practice',
  name: 'Practice',
  description: 'For clinics, dentists, labs, lawyers, accountants, advisers, photographers, designers, planners and consultants: a credentials and registration strip, practice areas or departments, consultation modes, timings, an appointment button and a clear disclaimer. Calm, clean, professional.',
  tier: 'Standard',
  tracks: ['professional'],
  families: ['healthcare', 'legal-finance', 'creative-consulting'],
  palette: makePalette({ h: 188, s: 0.55, accentShift: 25 }),
  fonts: { heading: 'Lora', body: 'Inter' },
  radius: '10px',
  presets,
};
