import { makePalette } from '../../lib/preset-build.mjs';
import presets from './presets.mjs';

// Hospitality and Property: restaurants, hotels, travel and real estate. Warm and image-led.
export default {
  id: 'free-hospitality',
  name: 'Hospitality and Property',
  description: 'For restaurants and cafes, hotels and homestays, travel agencies and real estate agents: a large picture with the booking button on it, a menu, rooms, packages or listings block, amenities, the location up front, and a reservation or enquiry button. Warm and image-led.',
  tier: 'Standard',
  tracks: ['professional'],
  families: ['hospitality-property'],
  palette: makePalette({ h: 12, s: 0.6, accentShift: 30 }),
  fonts: { heading: 'Playfair Display', body: 'Work Sans' },
  radius: '14px',
  presets,
};
