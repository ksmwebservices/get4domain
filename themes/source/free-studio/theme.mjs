import { makePalette } from '../../lib/preset-build.mjs';
import presets from './presets.mjs';

// Studio: education and wellness-beauty. Energetic, friendly, rounded.
export default {
  id: 'free-studio',
  name: 'Studio',
  description: 'For coaching centres, tutors, music and dance schools, salons, spas, gyms and yoga studios: courses or services with prices, batches or a class timetable, trainer or faculty cards, results or packages, and a trial or demo button. Energetic, friendly, rounded.',
  tier: 'Standard',
  tracks: ['professional'],
  families: ['education', 'wellness-beauty'],
  palette: makePalette({ h: 268, s: 0.7, accentShift: 55 }),
  fonts: { heading: 'Nunito', body: 'Poppins' },
  radius: '22px',
  presets,
};
